# 小猫来了

微信小程序 MVP，当前聚焦：

- 启动登录页
- 初次建猫 3 步引导
- 单猫档案
- 疫苗 / 驱虫 / 体重记录
- 家庭成员共享入口

## 开发环境

### 1. 准备环境

建议安装：

- Node.js 24+
- npm 10+
- 微信开发者工具

之所以要求 `Node 24+`，是因为后端当前使用了内置 `node:sqlite`。

### 2. 安装依赖

```bash
npm install
```

### 3. 环境自检

```bash
npm run doctor
```

### 4. 常用命令

```bash
npm run doctor
npm run typecheck
npm run build:miniprogram
npm run backend:start
```

## 小程序开发

### 构建产物

```bash
npm run build:miniprogram
```

微信开发者工具入口是：

```text
dist/miniprogram
```

### 当前小程序配置

关键配置在：

- [miniprogram/app.ts](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/miniprogram/app.ts)

默认是：

```ts
useMock: true
backendBaseUrl: "http://127.0.0.1:8787/api"
```

如果你要切本地后端联调，把 `useMock` 改成 `false`。

## 本地后端

后端目录：

```text
backend/
```

当前特性：

- Node 原生 `http` 服务
- SQLite 本地持久化
- session token 登录态
- session 自动续期
- 本地管理后台

### 启动后端

```bash
npm run backend:start
```

默认地址：

```text
http://127.0.0.1:8787
```

健康检查：

```text
GET /health
```

本地管理后台：

```text
http://127.0.0.1:8787/admin
```

### 微信登录后端说明

当前后端支持 `wx.login -> /api/auth/login/wechat`。

有两种模式：

1. 开发降级模式

未配置微信密钥时，后端会直接生成开发登录态，方便本地联调。

2. 真实微信校验模式

配置以下环境变量后，后端会调用微信 `jscode2session`：

```bash
WECHAT_APPID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
```

启动示例：

```bash
WECHAT_APPID=xxx WECHAT_APP_SECRET=xxx npm run backend:start
```

### 当前登录态机制

现在后端使用的是 `session token`，不是 JWT。

流程是：

1. 小程序调用 `wx.login`
2. 前端把 `code` 发给后端
3. 后端返回：
   - `sessionToken`
   - `sessionExpiresAt`
4. 小程序把 token 存进本地 storage
5. 后续请求自动通过 `Authorization: Bearer <token>` 带上
6. 快过期时自动请求 `/api/auth/refresh`

### 后端数据文件

初始化种子数据：

```text
backend/data/seed.json
```

运行时 SQLite 数据库：

```text
backend/data/runtime/app.db
```

运行时数据目录已经加入 `.gitignore`，不会污染仓库。

重置测试数据：

```text
POST /api/debug/reset
```

或者直接在本地管理后台点“重置测试数据”。

## SQLite 表结构

当前核心表：

- `auth_state`
- `sessions`
- `pets`
- `members`
- `records`
- `reminder_settings`

其中：

- 登录 token 保存在 `sessions`
- 猫咪档案保存在 `pets`
- 疫苗 / 驱虫 / 体重统一保存在 `records`

## 管理后台

后台入口：

```text
/admin
```

本地开发时，如果没有配置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，后台默认不加锁。

一旦配置了这两个环境变量：

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

以下入口都会启用 Basic Auth：

- `/admin`
- `/admin/app.js`
- `/admin/styles.css`
- `/api/admin/snapshot`
- `/api/admin/reset`
- `/api/debug/reset`

这层保护主要是为了部署到公网时，不让别人直接看到用户数据和 session。

## 部署准备

仓库里已经补了这些部署文件：

- [Dockerfile](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/Dockerfile)
- [.dockerignore](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/.dockerignore)
- [.env.example](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/.env.example)
- [ecosystem.config.cjs](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/ecosystem.config.cjs)
- [deploy/nginx.conf](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/deploy/nginx.conf)

### Docker 运行

```bash
docker build -t xiaomaolaile-backend .
docker run -d \
  --name xiaomaolaile-backend \
  -p 8787:8787 \
  --env-file .env.production \
  xiaomaolaile-backend
```

### PM2 运行

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### Nginx 反代

参考：

- [deploy/nginx.conf](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/deploy/nginx.conf)

正式环境建议：

- 给后端配独立域名
- 开启 HTTPS
- 小程序后台配置 `request` 合法域名

## 正式上线前还需要做的事

如果你要给别人真实体验，而不是只看 mock 演示版，接下来还需要：

1. 把后端部署到公网 HTTPS 域名
2. 把小程序 `useMock` 改成 `false`
3. 把 `backendBaseUrl` 改成线上 HTTPS 地址
4. 在微信小程序后台配置合法域名
5. 配置 `WECHAT_APPID / WECHAT_APP_SECRET`
6. 给 `/admin` 配置管理员用户名密码

## 当前体验路径

当前主流程是：

1. 启动登录页
2. 微信授权登录
3. 初次建猫 3 步引导
4. 首页

如果想重新体验：

1. 进入“我的”
2. 点击“退出登录”
3. 再次进入启动登录页

## 目录结构

```text
backend/                   本地后端
  admin/                   管理后台
  data/                    seed 和运行时数据库
  lib/                     SQLite 存储层
deploy/                    部署示例配置
miniprogram/               小程序源码
dist/miniprogram/          小程序构建产物
project.config.json        微信开发者工具配置
```
