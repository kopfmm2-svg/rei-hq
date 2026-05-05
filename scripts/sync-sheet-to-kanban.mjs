import { createSign } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const kanbanPath = resolve(root, 'kanban.json');

const DEFAULT_SHEET_ID = '1TrYGE6Z_WfQEJZzpmKeV-rmF4tby5U4zXTJ5o9tEj2I';
const DEFAULT_SHEET_GID = '661688425';
const BOARD_TITLE = '松原さん × Reiチーム タスクボード';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const COLUMN_CONFIG = [
  { id: 'today', priority: 'T', label: '🔴 今日中', color: '#ef4444', fallbackDate: '今日' },
  { id: 'thisweek', priority: 'W', label: '🟡 今週', color: '#f59e0b', fallbackDate: '今週' },
  { id: 'thismonth', priority: 'M', label: '🔵 1ヶ月', color: '#3b82f6', fallbackDate: '1ヶ月' },
  { id: 'someday', priority: 'Z', label: '⚪ いつか', color: '#64748b', fallbackDate: 'いつか' },
  { id: 'done', label: '✅ 完了済み', color: '#10b981' }
];

const STATUS_DONE_PATTERN = /完了|done|closed|complete/iu;

async function main() {
  const rows = await fetchSheetRows();
  const tasks = rows.map(rowToTask).filter(Boolean);
  const kanban = renderKanban(tasks);

  writeFileSync(kanbanPath, `${JSON.stringify(kanban, null, 2)}\n`);
  console.log(`Synced ${tasks.length} tasks from Google Sheets to kanban.json`);
}

async function fetchSheetRows() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    return fetchRowsWithAccessToken(process.env.GOOGLE_OAUTH_ACCESS_TOKEN);
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return fetchRowsWithServiceAccount();
  }

  return fetchRowsFromPublicCsv();
}

async function fetchRowsWithServiceAccount() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await getServiceAccountAccessToken(credentials);

  return fetchRowsWithAccessToken(accessToken);
}

async function fetchRowsWithAccessToken(accessToken) {
  const spreadsheetId = process.env.TASK_SHEET_ID || DEFAULT_SHEET_ID;
  const sheetGid = String(process.env.TASK_SHEET_GID || DEFAULT_SHEET_GID);

  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );
  if (!metadataResponse.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
  }

  const metadata = await metadataResponse.json();
  const sheet = metadata.sheets
    ?.map(item => item.properties)
    .find(properties => String(properties.sheetId) === sheetGid);

  if (!sheet?.title) {
    throw new Error(`Sheet gid ${sheetGid} was not found in spreadsheet ${spreadsheetId}.`);
  }

  const range = `${quoteSheetName(sheet.title)}!A:H`;
  const valuesUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}` +
    '?valueRenderOption=FORMATTED_VALUE';
  const valuesResponse = await fetch(valuesUrl, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!valuesResponse.ok) {
    throw new Error(`Failed to fetch spreadsheet values: ${valuesResponse.status} ${valuesResponse.statusText}`);
  }

  const payload = await valuesResponse.json();
  return tableToObjects(payload.values ?? []);
}

async function getServiceAccountAccessToken(credentials) {
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  );
  const unsignedToken = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsignedToken).sign(credentials.private_key);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to mint Google access token: ${response.status} ${response.statusText} ${details}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function fetchRowsFromPublicCsv() {
  const csvUrl =
    process.env.TASK_SHEET_CSV_URL ||
    `https://docs.google.com/spreadsheets/d/${process.env.TASK_SHEET_ID || DEFAULT_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${process.env.TASK_SHEET_GID || DEFAULT_SHEET_GID}`;

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch public sheet CSV: ${response.status} ${response.statusText}. ` +
        'For private sheets, set GOOGLE_OAUTH_ACCESS_TOKEN through GitHub OIDC/WIF or set GOOGLE_SERVICE_ACCOUNT_JSON, then share the Sheet with the service account email.'
    );
  }

  const csv = await response.text();
  return tableToObjects(parseCsv(csv));
}

function tableToObjects(table) {
  const [headerRow, ...bodyRows] = table;
  const headers = (headerRow ?? []).map(value => normalizeHeader(value));
  return bodyRows
    .map(values => {
      const row = {};
      headers.forEach((header, index) => {
        if (header) row[header] = normalizeCell(values[index]);
      });
      return row;
    })
    .filter(row => Object.values(row).some(Boolean));
}

function rowToTask(row) {
  const title = row['タイトル'];
  if (!title) return null;

  const id = row['ID'];
  if (!id) {
    throw new Error(`Task "${title}" is missing ID.`);
  }

  const priority = normalizePriority(row['優先度']);
  const status = row['ステータス'] || '⏳予定';
  const completed = STATUS_DONE_PATTERN.test(status) || Boolean(row['完了日']);

  return {
    id,
    priority,
    title: sanitizeField(title),
    owner: row['担当'] || '👤ユーザー',
    tags: splitTags(row['タグ']),
    deadline: row['期限'],
    completedDate: completed ? row['完了日'] || row['期限'] || todayJst() : ''
  };
}

function renderKanban(tasks) {
  const columns = COLUMN_CONFIG.map(column => ({ ...column, tasks: [] }));
  const columnById = new Map(columns.map(column => [column.id, column]));

  for (const task of tasks) {
    if (task.completedDate) {
      columnById.get('done').tasks.push(formatTask(task, true));
      continue;
    }

    const column = columns.find(item => item.priority === task.priority) ?? columnById.get('thisweek');
    column.tasks.push(formatTask(task, false, column.fallbackDate));
  }

  return {
    meta: {
      title: BOARD_TITLE,
      updated: todayJst(),
      updatedBy: 'sheet-sync'
    },
    columns: columns.map(({ priority, fallbackDate, ...column }) => column)
  };
}

function formatTask(task, completed, fallbackDate = '') {
  const base = {
    id: String(task.id),
    title: task.title,
    owner: sanitizeField(task.owner),
    tags: task.tags
  };

  if (completed) {
    return { ...base, completedDate: sanitizeField(task.completedDate) };
  }

  return { ...base, deadline: sanitizeField(task.deadline || fallbackDate) };
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function splitTags(value) {
  return String(value || '')
    .split(/[\/,、]/u)
    .map(item => sanitizeField(item.trim()))
    .filter(Boolean);
}

function normalizePriority(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['T', 'W', 'M', 'Z'].includes(normalized) ? normalized : 'W';
}

function normalizeHeader(value) {
  return normalizeCell(value).replace(/^\uFEFF/u, '');
}

function normalizeCell(value) {
  return String(value ?? '').replace(/\r?\n/gu, ' ').trim();
}

function sanitizeField(value) {
  return String(value ?? '').replace(/\|/gu, '／').replace(/\s+/gu, ' ').trim();
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/gu, "''")}'`;
}

function todayJst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function base64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
