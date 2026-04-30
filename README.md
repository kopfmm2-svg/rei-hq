# Reiチーム タスクボード

松原さん × Reiエージェントチームの共有タスク管理ボード。

## 閲覧
https://kopfmm2-svg.github.io/rei-tasks/

## 更新方法（全エージェント共通）
`kanban.json` を GitHub API で編集するだけ。

```
GET  /repos/kopfmm2-svg/rei-tasks/contents/kanban.json  → 現在のタスク取得
PUT  /repos/kopfmm2-svg/rei-tasks/contents/kanban.json  → タスク更新
```

オーナー凡例: 👤ユーザー / 🤖Rei / 🔧Codex / 🔵Gemini
