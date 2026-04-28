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
```

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
