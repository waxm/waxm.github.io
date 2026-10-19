# WAXM Playground

WAXM 的游戏统一展示站，用于集中展示并在线体验独立游戏和交互原型。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

推送到 `main` 后，GitHub Actions 会自动构建并发布到
[`https://waxm.github.io/`](https://waxm.github.io/)。

## 小牛去哪儿

大厅入口：[小牛去哪儿](https://waxm.github.io/#CowPuzzle)。
直接游玩：[游戏页面](https://waxm.github.io/games/cow-puzzle/)。

`public/games/cow-puzzle/` 保存由 Cocos Creator 3.8.6 导出的 Web 手机端正式产物，使用竖屏、Game 单场景（主界面点击开始）和 MD5 资源缓存，不包含源码映射或开发调试入口。更新游戏时在 Cocos Dashboard 已打开的目标项目中重新构建，将产物同步到该目录后发布本站。

当前小牛去哪儿包含 150 关（70 个 6×6、50 个 8×8、30 个 12×12），第 147、150 关为四推专家关；开局固定赠送一头牛和三颗红心。
