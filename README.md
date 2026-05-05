# Reiチーム タスクボード

松原さん × Reiエージェントチームの共有タスク管理ボード。

## 閲覧
https://kopfmm2-svg.github.io/rei-hq/

## 更新方法
Google Sheetsを入力UIにして、GitHub Actionsで `kanban.json` を生成します。

入力シート:
https://docs.google.com/spreadsheets/d/1TrYGE6Z_WfQEJZzpmKeV-rmF4tby5U4zXTJ5o9tEj2I/edit

優先度:

- `T`: 今日中
- `W`: 今週
- `M`: 1ヶ月
- `Z`: いつか

`kanban.json` は生成物です。手動編集した内容は次の同期で上書きされる可能性があります。

## スマホから同期する
GitHub の Actions で **Sync Kanban from Google Sheets** を開き、**Run workflow** を押すと、Google Sheetsから `kanban.json` を更新します。

非公開Google Sheetsを読むために、リポジトリSecret `GOOGLE_SERVICE_ACCOUNT_JSON` が必要です。Service Accountのメールアドレスに対象スプレッドシートの閲覧権限を付けてください。

手動実行に加えて、毎時 `:07` に定期同期します。

## ローカル同期
Service Account JSONを環境変数に入れて実行します。

```sh
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' node scripts/sync-sheet-to-kanban.mjs
```

オーナー凡例: 👤ユーザー / 🤖Rei / 🔧Codex / 🔵Gemini
