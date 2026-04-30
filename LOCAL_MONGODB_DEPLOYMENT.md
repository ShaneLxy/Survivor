# Survivor Local MongoDB Deployment

## Architecture

- Frontend: packaged as a Capacitor Android app
- Backend: local Nest service running on your machine
- Database: local MongoDB
- Public access: Cloudflare Tunnel forwarding to the local Nest service

## Backend env

You now have three env files:

- [server/.env.test](/E:/AIGame/Survivor/server/.env.test): local test database `survivor_test`
- [server/.env.production](/E:/AIGame/Survivor/server/.env.production): local production database `survivor`
- [server/.env.local](/E:/AIGame/Survivor/server/.env.local): fallback local config

All of them currently point to the same MongoDB server, but use different database names when needed.

## Backend commands

Run these inside `server`:

```powershell
# Test backend, isolated data
npm run start:dev:test

# Production backend, real local data
npm run start:dev:prod
```

If you need to change the MongoDB server address, edit the `MONGODB_URI` in the env file you are using:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=survivor
```

## Frontend API endpoint

Before packaging the app, edit [js/config/RuntimeConfig.js](/E:/AIGame/Survivor/js/config/RuntimeConfig.js) and set:

```js
window.__SURVIVOR_RUNTIME_CONFIG__ = Object.assign({
    apiBaseUrl: 'https://your-cloudflare-domain.example.com/api'
}, window.__SURVIVOR_RUNTIME_CONFIG__ || {});
```

Then build the Android package:

```powershell
npm run android:build:release
```

## Run order

1. Start MongoDB locally.
2. Start the backend with either `npm run start:dev:test` or `npm run start:dev:prod` inside `server`.
3. Verify `http://127.0.0.1:3000/api/health` works locally.
4. Point Cloudflare Tunnel to `http://127.0.0.1:3000`.
5. Put the Cloudflare HTTPS domain into `js/config/RuntimeConfig.js`.
6. Rebuild the Android app and distribute the new package.

## Notes

- Existing Tencent Cloud data will not automatically appear in MongoDB. If you need migration, we should add a one-time import script.
- If the Cloudflare domain changes later, update `js/config/RuntimeConfig.js` and rebuild the app.
