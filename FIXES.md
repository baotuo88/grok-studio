# Cloudflare 部署问题修复说明

## 已修复问题

### 1. 普通用户模型下拉框一直显示“加载模型中”
- 修复点：`js/app.js`
- 处理内容：
  - 新增 `setModelSelectState()`，在配置缺失或加载失败时明确显示状态，不再卡在“加载中”。
  - `reinitializeApp()` 增加无配置分支，普通用户会得到明确提示，管理员会自动打开配置弹窗。
  - `loadModels()` 异常时会把下拉框状态切换到“模型加载失败”。

### 2. 管理员看不到普通用户信息
- 修复点：`js/user.js`、`js/app.js`
- 处理内容：
  - 用户注册逻辑增强：登录/初始化时都会注册本地用户。
  - 用户名提取逻辑修正：避免用户名含 `_` 时被截断。
  - 新增 `getIndexedDBUsers()` 与 `getAllUsersAsync()`，合并来源：
    - 本地用户列表
    - IndexedDB 数据库名
    - Cloudflare KV 用户列表（可选）
  - 用户管理面板改为异步加载用户列表。

### 3. 刷新页面后总是要求重新登录
- 修复点：`js/app.js`
- 处理内容：
  - 已登录初始化时主动调用 `hideLoginModal()`，避免刷新后登录弹窗误显示。
  - 登录成功后改为 `window.location.reload()`，统一走完整初始化路径，避免“登录后状态不完整”。
  - 管理员首次登录改密逻辑移动到完整初始化后触发，避免事件未绑定导致流程中断。

## 新增 Cloudflare 跨设备共享能力（可选）

> 纯本地模式下，管理员配置和用户列表只在当前浏览器有效。  
> 启用本次新增的 Cloudflare KV 接口后，可跨浏览器/跨设备共享。

新增文件：
- `functions/api/shared-config.js`
- `functions/api/users.js`

用途：
- `shared-config`: 共享管理员 API 配置
- `users`: 共享用户列表

前端已自动集成：
- 普通用户初始化时会尝试从 `/api/shared-config` 拉取配置
- 用户登录时会尝试注册到 `/api/users`
- 管理员保存配置时会同步到 `/api/shared-config`

## Cloudflare 配置步骤

1. 在 Cloudflare Pages 项目里绑定 KV：
   - 变量名：`GROK_STORE`
2. 可选：设置环境变量 `ADMIN_WRITE_TOKEN` 限制写入权限
3. 如果设置了令牌，浏览器端要写入：
   - localStorage key: `grok_admin_write_token`
   - value: 与 `ADMIN_WRITE_TOKEN` 一致

## 验证建议

1. 管理员在 A 浏览器保存 API 配置后，普通用户在 B 浏览器登录，模型应可加载。
2. 普通用户在 B 浏览器登录后，管理员在 A 浏览器打开用户管理，应可看到该用户。
3. 任意用户刷新页面，不应再被误弹登录框。
