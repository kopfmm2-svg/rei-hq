# Project: LINE 外部脳（personal-brain）

**ステータス**: 🟡 コード完成・外部セットアップ待ち  
**引き継ぎ元**: Codex エージェント (2026-04-30)  
**コード場所**: `/Users/matsubaramasayuki/Documents/New project/`

---

## 概要
LINEで `脳 URL` と送るとページを要約してGitHubに保存 → Obsidianで読める

## アーキテクチャ
LINE → Cloudflare Worker → GitHub (personal-brain) → Mac sync → Obsidian

---

## ✅ 完了済み
- [x] Cloudflare Worker コード実装
- [x] LINE Official Account 作成・Messaging API 有効化
- [x] GitHub repo `kopfmm2-svg/personal-brain` 作成（privateにすること）
- [x] ローカルテスト通過
- [x] コードをGitHubにpush済み
- [x] Node.js (LTS) を nvm でインストール済み
- [x] wrangler login 完了済み

## ⚠️ セキュリティ注意
- チャットにChannel secret / access tokenを貼ってしまったため**再生成必須**
- 新しい値はChatに貼らずCloudflare Secretsに直接入れる（wrangler secret put のプロンプト）

## 🚀 残りタスク — Codexに委託（引き継ぎ書参照）
**引き継ぎ書**: `/Users/matsubaramasayuki/cc-booster-v1-release/secretary/todos/codex-dispatch-2026-04-30.md`

1. [P0] [ ] `npx wrangler deploy` → webhook URL 取得
2. [P0] [ ] Worker secrets 設定（LINE/GitHub トークン）
3. [P0] [ ] LINE Channel secret / access token を**再生成**
4. [P0] [ ] LINE webhook URL に Worker URL を設定
5. [P1] [ ] テストメッセージ送信 → LINE user ID 取得
6. [P1] [ ] `ALLOWED_USER_IDS` に自分のIDを設定・再デプロイ
7. [P1] [ ] Mac sync script + launchd 設定
8. [P2] [ ] OpenAI API キー取得してLLM強化（後回し可）

## 参考
- 引き継ぎ書: `/Users/matsubaramasayuki/Documents/New project/docs/agent-handoff-2026-04-30.md`
