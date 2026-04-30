# Codex エージェント定義

**ロール**: 実装担当  
**得意領域**: 重い実装・大量コード生成・長時間タスク

## Dispatchの渡し方

1. `handoffs/codex-YYYY-MM-DD.md` を作成（Reiが書く）
2. Codexに「引き継ぎ書のパスを渡す」
3. 完了したら `kanban.json` の該当タスクを完了に更新

## kanban.json 更新方法

```
PUT https://api.github.com/repos/kopfmm2-svg/rei-hq/contents/kanban.json
Authorization: token <GITHUB_TOKEN>
```

タスク完了時: `columns[id=done].tasks` に移動、`completedDate` と `owner` を記入
