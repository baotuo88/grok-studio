# Grok Studio - 聊天与图像生成

一个基于 Grok API 的全功能 Web 应用，支持聊天对话和图像生成，具备完善的用户管理和配额控制系统。

## 主要功能

### 1. 聊天功能
- 支持多轮对话，保持上下文
- Markdown 渲染，支持代码高亮
- 会话管理（创建、切换、重命名、删除）
- 代码块一键复制
- 支持多种聊天模型

### 2. 图像生成
- 文生图：根据提示词生成图像
- 图生图：基于参考图像生成变体
- 图像编辑：支持多张参考图像（最多16张）
- 视频生成：支持生成短视频
- 自定义参数：宽高比、生成数量、变化强度等

### 3. 用户管理系统 ⭐ 新增
- **多用户支持**：不同用户数据完全隔离
- **管理员系统**：
  - 首次登录强制修改默认密码
  - 全局 API 配置权限
  - 用户管理界面
  - 配额管理功能
- **记住我功能**：支持保持登录状态（7天）
- **会话管理**：自动过期机制（24小时）

### 4. 配额管理系统 ⭐ 新增
- **每日配额限制**：
  - 聊天次数限制（默认100次/天）
  - 图像生成次数限制（默认50次/天）
- **自动重置**：每日 00:00 自动重置配额
- **实时监控**：使用前自动检查配额
- **灵活配置**：管理员可为每个用户单独设置配额

### 5. 使用统计功能 ⭐ 新增
- **多维度统计**：
  - 今日使用量
  - 本月使用量
  - 总使用量
- **详细记录**：
  - 使用时间
  - 使用类型（聊天/图像）
  - 模型信息
  - 内容详情
- **可视化展示**：直观的统计卡片和图表

## 使用说明

### 首次使用

1. **普通用户登录**：
   - 首次使用请切换到“注册模式”，创建用户名 + 密码（密码至少 6 位）
   - 注册成功后自动登录，后续必须使用同一用户名和密码登录
   - 用户名全局唯一，不可重复注册

2. **管理员登录**：
   - 用户名：`admin`
   - 默认密码：`admin123`
   - 首次登录会强制要求修改密码
   - 修改后的密码会安全保存在本地

### 管理员功能

#### 1. 修改密码
- 点击顶部导航栏的钥匙图标
- 输入原密码和新密码
- 新密码至少6个字符

#### 2. 用户管理
- 点击顶部导航栏的用户管理图标
- 查看所有用户列表
- 为每个用户设置聊天和图像配额
- 删除用户及其所有数据（管理员账户除外）

#### 3. API 配置
- 只有管理员可以配置全局 API
- 默认仅在当前浏览器内共享
- 如需跨浏览器/跨设备共享，请启用 Cloudflare KV 同步（见下方说明）

### 配额说明

#### 默认配额
- 聊天：100次/天
- 图像生成：50次/天

#### 配额重置
- 每日 00:00 自动重置
- 重置后使用次数归零

#### 配额检查
- 发送聊天消息前自动检查
- 生成图像前自动检查
- 超出限制会提示错误信息

### 使用统计

#### 查看统计
- 点击顶部导航栏的图表图标
- 查看个人使用统计
- 包含今日、本月、总计数据

#### 统计内容
- 聊天使用次数
- 图像生成次数
- 剩余配额显示
- 使用趋势分析

## 技术特性

- 纯前端实现，无需后端服务器
- 数据存储在浏览器本地（LocalStorage + IndexedDB）
- 可选 Cloudflare Pages Functions + KV 云端同步（共享 API 配置、用户列表、用户配额）
- 响应式设计，支持移动端
- 现代化 UI，流畅的动画效果
- 完善的错误处理和用户提示

## 数据安全

- 默认数据仅存储在本地浏览器
- 启用 Cloudflare KV 后，管理员 API 配置、用户列表、用户配额会同步到云端 KV
- 不同用户数据完全隔离
- 管理员密码加密存储
- 会话自动过期保护
- 支持一键清除所有数据

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 部署方法

本项目是纯前端应用，无需后端服务器，支持多种部署方式：

### 方法一：本地直接运行
1. 下载项目所有文件
2. 使用浏览器直接打开 `index.html` 文件
3. 开始使用

### 方法二：静态网站托管

#### 1. GitHub Pages（免费）
```bash
# 1. 创建 GitHub 仓库
# 2. 上传所有文件到仓库
# 3. 在仓库设置中启用 GitHub Pages
# 4. 选择分支和根目录
# 5. 访问 https://你的用户名.github.io/仓库名
```

#### 2. Vercel（免费，推荐）
```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 在项目目录运行
vercel

# 3. 按提示完成部署
# 4. 获得免费的 HTTPS 域名
```

#### 3. Netlify（免费）
```bash
# 1. 安装 Netlify CLI
npm install -g netlify-cli

# 2. 在项目目录运行
netlify deploy

# 3. 按提示完成部署
# 4. 获得免费的 HTTPS 域名
```

#### 4. Cloudflare Pages（免费）
1. 登录 Cloudflare Dashboard
2. 进入 Pages 页面
3. 连接 Git 仓库或直接上传文件
4. 自动部署并获得免费域名
5. （可选，推荐）在项目 `Settings > Functions > KV namespace bindings` 添加绑定：
   - 变量名：`GROK_STORE`
   - KV Namespace：新建或选择一个命名空间
6. （可选）添加环境变量 `ADMIN_WRITE_TOKEN`，用于限制谁可以写入云端配置
7. 如果设置了 `ADMIN_WRITE_TOKEN`，在浏览器 `localStorage` 写入同名值：
   - key: `grok_admin_write_token`
   - value: 与 Cloudflare 环境变量一致

#### 5. 阿里云 OSS / 腾讯云 COS（国内）
```bash
# 1. 创建 OSS/COS 存储桶
# 2. 开启静态网站托管
# 3. 上传所有文件
# 4. 配置自定义域名（可选）
# 5. 开启 CDN 加速（可选）
```

### 方法三：Docker 部署

创建 `Dockerfile`：
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

部署命令：
```bash
# 构建镜像
docker build -t grok-studio .

# 运行容器
docker run -d -p 80:80 grok-studio
```

### 方法四：传统 Web 服务器

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/grok-web;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Apache
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/grok-web
    
    <Directory /path/to/grok-web>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

## 支持的部署平台

### 国际平台
| 平台 | 免费额度 | HTTPS | 自定义域名 | CDN | 推荐度 |
|------|---------|-------|-----------|-----|--------|
| **Vercel** | 无限 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **Netlify** | 100GB/月 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **GitHub Pages** | 100GB/月 | ✅ | ✅ | ❌ | ⭐⭐⭐⭐ |
| **Cloudflare Pages** | 无限 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **Firebase Hosting** | 10GB/月 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐ |
| **Surge.sh** | 无限 | ✅ | ✅ | ❌ | ⭐⭐⭐ |

### 国内平台
| 平台 | 费用 | HTTPS | 自定义域名 | CDN | 备案要求 |
|------|------|-------|-----------|-----|---------|
| **阿里云 OSS** | 按量计费 | ✅ | ✅ | ✅ | 需要 |
| **腾讯云 COS** | 按量计费 | ✅ | ✅ | ✅ | 需要 |
| **七牛云** | 10GB免费 | ✅ | ✅ | ✅ | 需要 |
| **又拍云** | 10GB免费 | ✅ | ✅ | ✅ | 需要 |
| **Gitee Pages** | 免费 | ❌ | ❌ | ❌ | 不需要 |

### 推荐方案

#### 个人使用（国际）
- **首选**：Vercel 或 Cloudflare Pages
- **优点**：免费、快速、自动 HTTPS、全球 CDN
- **缺点**：国内访问可能较慢

#### 个人使用（国内）
- **首选**：阿里云 OSS + CDN
- **优点**：国内访问快、稳定
- **缺点**：需要备案、有一定费用

#### 团队使用
- **首选**：自建服务器 + Nginx/Apache
- **优点**：完全控制、数据安全
- **缺点**：需要运维

## 部署注意事项

1. **API 配置**
   - 部署后首次访问需要管理员登录配置 API
   - 默认保存在浏览器本地；启用 Cloudflare KV 后会自动同步到云端
   - 普通用户若看到“加载模型中”不变化，通常是当前浏览器还没有可用 API 配置
   - 账号注册/登录依赖 Cloudflare Functions（`/api/auth`）与 KV 绑定 `GROK_STORE`

2. **数据存储**
   - 聊天记录、图片历史、配额和登录态仍存储在本地浏览器
   - 启用 Cloudflare KV 后，管理员 API 配置、用户列表、用户配额会跨设备共享
   - 启用 Cloudflare KV 后，用户每次配额消耗会优先写入云端（管理员面板可实时看到）
   - 清除浏览器数据会导致数据丢失
   - 建议定期导出重要数据

3. **HTTPS 要求**
   - 建议使用 HTTPS 部署
   - 某些浏览器功能（如剪贴板）需要 HTTPS

4. **跨域问题**
   - 如果 API 服务器不支持 CORS，需要配置代理
   - 或使用支持 CORS 的 API 服务

5. **性能优化**
   - 启用 CDN 加速
   - 开启 Gzip 压缩
   - 配置浏览器缓存

## 快速部署示例

### Vercel 一键部署
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/grok-web)

### Netlify 一键部署
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/你的用户名/grok-web)

## 注意事项

1. **数据备份**：数据存储在浏览器本地，清除浏览器数据会导致数据丢失
2. **API 配置**：需要有效的 Grok API 密钥才能使用
3. **配额管理**：管理员可根据实际需求调整用户配额
4. **密码安全**：管理员密码遗失无法找回，请妥善保管

## 更新日志

### v2.0.0 (2026-02-16)
- ✨ 新增：强制管理员首次登录修改密码
- ✨ 新增：记住我和保持登录功能
- ✨ 新增：管理员用户管理界面
- ✨ 新增：用户配额管理系统
- ✨ 新增：使用统计功能
- 🔒 增强：会话安全管理
- 🎨 优化：UI 界面和交互体验

### v1.0.0
- 基础聊天功能
- 图像生成功能
- 用户登录系统
- 历史记录管理

## 开发者

如需自定义或二次开发，请参考源代码中的注释。

## 许可证

MIT License
