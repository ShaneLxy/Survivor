# Survivor GM Desktop

Windows GM 桌面工具，用于管理 Survivor 的资源目录、玩家邮件和 CDKEY。

## 启动

1. 先启动服务端：

```powershell
cd server
npm run start:dev
```

2. 安装并启动桌面端：

```powershell
cd gm-desktop
npm install
npm start
```

默认连接 `http://127.0.0.1:3000/api`。本地 `.env.local` 默认 GM 密钥为 `survivor_gm_secret`。正式环境请修改 `server/.env.production` 里的 `GM_SECRET`，并在桌面端“连接设置”里填同一个值。

## 功能

- 资源、道具、装备目录查询、筛选、新增和修改。
- 支持图片路径、图片 URL，也支持选择本地图片后保存为 data URL。
- 按玩家 ID 或全体玩家发送邮件，可添加资源和道具附件。
- CDKEY 批量生成、手动导入、查询和批量启停/改标题/改过期时间。
- 桌面端调用 `/api/gm/*` 接口，所有管理写操作都需要 `x-gm-secret`。
