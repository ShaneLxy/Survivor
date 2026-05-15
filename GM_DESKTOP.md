# Survivor GM 桌面工具

本次新增了一个独立 GM 桌面管理台和配套服务端接口。

## 运行方式

先启动服务端：

```powershell
npm run gm:server
```

首次使用桌面端前安装 Electron：

```powershell
cd gm-desktop
npm install
```

之后从仓库根目录启动：

```powershell
npm run gm:desktop
```

默认地址是 `http://127.0.0.1:3000/api`。本地 `.env.local` 默认密钥是 `survivor_gm_secret`；正式环境必须修改 `server/.env.production` 的 `GM_SECRET`，桌面端“连接设置”里也要填同一个值。

## 已支持功能

- 资源、道具、装备目录查询、筛选、新增、修改。
- 图片字段支持资源路径、远程 URL、本地图片转 data URL。
- 按玩家 ID 或全体玩家发送邮件，支持资源和道具附件。
- CDKEY 批量生成、手动导入、查询、批量启停、批量修改标题和过期时间。
- 游戏客户端启动时会从 `/api/gm/catalog/public` 加载 GM 覆盖配置。

## 运营建议

- 正式服不要使用默认 `GM_SECRET`，建议改为强随机密钥，并限制 GM 接口来源 IP。
- 邮件、CDKEY、资源配置的写操作后续最好补操作日志，记录操作者、时间、差异和原因。
- CDKEY 建议增加批次维度的导出、作废和兑换统计，便于活动复盘。
- 资源配置建议在正式发布前增加“草稿 / 发布”状态，避免误改立即影响线上客户端。
