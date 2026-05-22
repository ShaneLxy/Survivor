// 任务/成就系统已迁移到 GM catalog 数据驱动(2026/05/21 重构)。
// 原本 patch 中添加的 achievement_finish_tutorial 已并入 TaskManager.FALLBACK_ACHIEVEMENTS
// 并迁移到 server/data/gm-catalog-overrides.json,tutorialComplete 事件由 TaskManager.EVENT_DEFINITIONS 统一监听。
// 该文件保留为空占位,等后续清理时连同 index.html 的引用一起删除。
