# 小猫来了

微信小程序 MVP，当前聚焦：

- 启动登录页
- 初次建猫 3 步引导
- 单猫档案
- 疫苗 / 驱虫 / 体重记录
- 家庭成员共享入口

## 换电脑继续开发

### 1. 准备环境

新电脑需要安装：

- Node.js 18+
- npm 9+
- 微信开发者工具

### 2. 拿到项目代码

把整个项目目录带到新电脑，建议放进 Git 仓库后再 clone。

项目根目录就是当前这个目录：

```bash
/Users/jeremy/Desktop/Vibe Coding/Codex/小猫来了
```

### 3. 先做环境自检

```bash
npm run doctor
```

这个命令会检查：

- 关键项目文件是否齐全
- `node_modules` 是否缺失
- `node_modules` 是否还是旧机器上的软链接
- `dist/miniprogram` 是否已经构建

### 4. 重新安装依赖

当前仓库里 `node_modules` 可能是指向别的目录的软链接。换电脑后不要沿用它，直接在项目根目录重新安装：

```bash
rm -rf node_modules
npm install
```

如果你是通过 Git 拉代码，一般本来也不会带上 `node_modules`。

### 5. 构建小程序产物

```bash
npm run build:miniprogram
```

这个项目的微信开发者工具入口指向：

```text
dist/miniprogram
```

也就是说，先构建，再打开项目会更稳。

### 6. 用微信开发者工具打开

打开项目根目录即可，`project.config.json` 已经配置好了：

- AppID：`wx3d79a9d52f967c06`
- `miniprogramRoot`：`dist/miniprogram/`

如果你没有这个小程序的开发权限，需要：

- 使用有权限的微信开发者账号登录开发者工具
- 或者临时替换成自己的测试 AppID

## 常用命令

```bash
npm run doctor
npm run typecheck
npm run build:miniprogram
npm run backend:start
```

## 本地后端

项目现在已经带了一个本地 MVP 后端，位置在：

```text
backend/
```

特性：

- Node 原生 `http` 服务，无额外依赖
- 本地 JSON 持久化
- 覆盖当前小程序需要的核心接口：
  - 登录态
  - 首页数据
  - 单猫档案
  - 疫苗 / 驱虫 / 体重记录
  - 家庭成员
  - 提醒设置
  - 邀请信息

### 启动后端

```bash
npm run backend:start
```

默认地址：

```text
http://127.0.0.1:8787
```

本地管理后台地址：

```text
http://127.0.0.1:8787/admin
```

健康检查：

```text
GET /health
```

### 本地切换到真实后端

当前小程序默认还是 `mock` 模式，配置在：

- [miniprogram/app.ts](/Users/jeremy/Desktop/Vibe%20Coding/Codex/小猫来了/miniprogram/app.ts)

如果你要切到本地后端，把：

```ts
useMock: true
```

改成：

```ts
useMock: false
```

后端基地址默认就是：

```ts
backendBaseUrl: "http://127.0.0.1:8787/api"
```

### 微信登录后端说明

当前后端已经支持 `wx.login -> 后端登录接口` 这条链路：

- 小程序启动页会先调用 `wx.login`
- 然后把 `code` 发给：

```text
POST /api/auth/login/wechat
```

后端现在有两种模式：

1. 开发降级模式

如果没有配置微信密钥，后端会直接把当前用户标记为已登录，方便本地联调。

2. 真实微信校验模式

如果你启动后端前配置了下面两个环境变量：

```bash
WECHAT_APPID=你的小程序AppID
WECHAT_APP_SECRET=你的小程序AppSecret
```

后端就会调用微信 `jscode2session` 接口校验 `wx.login` 返回的 `code`。

启动示例：

```bash
WECHAT_APPID=xxx WECHAT_APP_SECRET=xxx npm run backend:start
```

### 当前登录态机制

现在本地后端已经加了一个轻量 session 机制：

- 登录成功后，后端会返回 `sessionToken`
- 同时会返回 `sessionExpiresAt`
- 小程序会把 token 存到本地 storage
- 后续请求会自动通过 `Authorization: Bearer <token>` 带上
- 当 session 快到期时，小程序会自动调用 `/api/auth/refresh` 续期
- 登出或接口返回 `401` 时，小程序会自动清掉本地 token

这意味着：

- 现在已经不是单纯依赖内存里的“已登录标记”
- 后续切数据库、云开发、正式鉴权时，这层前端结构可以直接复用

### 后端数据文件

初始种子数据：

```text
backend/data/seed.json
```

运行时数据：

```text
backend/data/runtime/db.json
```

运行时数据已经加入 `.gitignore`，不会污染仓库。

如果你想把后端数据重置回初始状态，可以调用：

```text
POST /api/debug/reset
```

也可以直接在本地管理后台点“重置测试数据”按钮。

## 当前体验路径

当前 mock 流程是：

1. 启动登录页
2. 微信授权登录（mock）
3. 初次建猫 3 步引导
4. 进入首页

如果想重新体验登录和首次引导：

1. 进入“我的”
2. 点击“退出登录”
3. 重新进入启动登录页

## 目录结构

```text
miniprogram/               小程序源码
  pages/                   页面
  services/                API 层
  store/                   mock 状态
  data/                    mock 数据
  types/                   类型定义
dist/miniprogram/          构建产物
project.config.json        微信开发者工具配置
```

## 注意事项

- `project.private.config.json` 是本地开发者工具私有配置，不需要同步。
- `dist/` 是构建产物，可以重新生成。
- 如果后面接入真实后端 / 云开发，换电脑时还要同步环境变量、云环境 ID 和后台配置。
