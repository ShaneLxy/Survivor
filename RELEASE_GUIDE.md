# 发布说明

## 一、前端发布

每次前端发布前，先在项目根目录执行：

```bash
npm run release:version 2026.04.20.1
```

把 `2026.04.20.1` 替换成你这次要发布的真实版本号。

这一步会自动更新：

- `index.html` 中的前端静态资源版本号
- `js/config/VersionManager.js` 中的当前构建版本号

执行完成后，把前端静态资源重新上传到静态网站托管。

需要上传的内容：

- `index.html`
- `css/`
- `js/`
- `assets/`
- `data/`

不需要上传的内容：

- `server/`
- `android/`
- `node_modules/`
- `scripts/`

## 二、后端发布

后端发布在 `server` 目录下进行。

进入后端目录：

```bash
cd server
```

首次部署或依赖变化后先执行：

```bash
npm install
```

每次发布前执行：

```bash
npm run build
```

编译完成后会生成：

- `server/dist/`

后端部署时，至少需要带上这些内容：

- `dist/`
- `package.json`
- `node_modules/`

如果你的腾讯云部署方式还要求额外启动文件或平台入口文件，也要一起上传。

## 三、版本控制说明

当前项目已经支持前后端联合版本控制。

### 前端版本号

前端当前运行版本显示在登录页左上角。

前端版本来源：

- `index.html` 中的 `window.__SURVIVOR_BUILD_VERSION__`

正常情况下不要手动改文件，直接运行：

```bash
npm run release:version 版本号
```

即可。

### 后端版本策略

后端通过版本策略接口控制不同平台是否需要更新。

接口地址：

- `/api/health/version`

后端通过环境变量控制版本策略。

常用变量如下：

#### 全局默认版本

- `FRONTEND_BUILD_VERSION`

#### 网页端

- `WEB_VERSION_LATEST`
- `WEB_VERSION_MIN`
- `WEB_VERSION_FORCE`
- `WEB_UPDATE_MESSAGE`

#### 安卓端

- `ANDROID_VERSION_LATEST`
- `ANDROID_VERSION_MIN`
- `ANDROID_VERSION_FORCE`
- `ANDROID_UPDATE_MESSAGE`

#### 微信小程序端

- `WECHAT_MINI_PROGRAM_VERSION_LATEST`
- `WECHAT_MINI_PROGRAM_VERSION_MIN`
- `WECHAT_MINI_PROGRAM_VERSION_FORCE`
- `WECHAT_MINI_PROGRAM_UPDATE_MESSAGE`

## 四、推荐发布流程

### 普通更新

1. 前端执行：

```bash
npm run release:version 2026.04.20.1
```

2. 上传前端静态资源
3. 后端更新环境变量：

- `FRONTEND_BUILD_VERSION=2026.04.20.1`
- `WEB_VERSION_LATEST=2026.04.20.1`
- `ANDROID_VERSION_LATEST=2026.04.20.1`
- `WECHAT_MINI_PROGRAM_VERSION_LATEST=2026.04.20.1`

4. 后端重新构建并部署

### 强制安卓更新

如果安卓旧包必须停用，则在后端环境变量中额外设置：

- `ANDROID_VERSION_LATEST=2026.04.20.1`
- `ANDROID_VERSION_MIN=2026.04.20.1`
- `ANDROID_VERSION_FORCE=true`
- `ANDROID_UPDATE_MESSAGE=当前版本已停止支持，请前往发布平台下载最新版安装包。`

然后重新部署后端即可。

### 网页端提示刷新

如果网页端只是提醒玩家刷新，不做强制拦截，可以设置：

- `WEB_VERSION_LATEST=2026.04.20.1`
- `WEB_VERSION_MIN=2026.04.19.0`
- `WEB_VERSION_FORCE=false`
- `WEB_UPDATE_MESSAGE=检测到新版本，请刷新页面以获取最新内容。`

## 五、最简记忆版

每次发版只记这四步：

1. 前端执行：

```bash
npm run release:version 新版本号
```

2. 上传前端静态资源
3. 后端更新版本相关环境变量
4. 后端重新构建并部署
