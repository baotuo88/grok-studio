# 如何正确运行 Grok Studio

## 问题说明

如果你直接双击打开 `index.html` 文件（使用 `file://` 协议），浏览器会限制 localStorage 的使用，导致：
- ❌ 登录状态无法保存
- ❌ 每次刷新都需要重新登录
- ❌ 聊天历史无法保存
- ❌ 图像历史无法保存

## 解决方案：使用本地服务器

### 方法 1：使用提供的启动脚本（推荐）

#### Windows 用户
双击运行 `start-server.bat`

#### Mac/Linux 用户
```bash
chmod +x start-server.sh
./start-server.sh
```

然后在浏览器中访问：`http://localhost:8000`

### 方法 2：手动启动 Python 服务器

在项目目录下打开终端/命令行，运行：

```bash
# Python 3
python -m http.server 8000

# 或 Python 2
python -m SimpleHTTPServer 8000
```

然后在浏览器中访问：`http://localhost:8000`

### 方法 3：使用 VS Code Live Server

1. 安装 VS Code 扩展：Live Server
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"

### 方法 4：使用 Node.js http-server

```bash
# 安装（仅需一次）
npm install -g http-server

# 运行
http-server -p 8000
```

## 验证是否成功

使用本地服务器后：
1. ✅ 登录后勾选"记住我"，刷新页面不需要重新登录
2. ✅ 聊天历史会自动保存
3. ✅ 图像历史会自动保存
4. ✅ 用户配置会自动保存

## 常见问题

### Q: 为什么不能直接打开 HTML 文件？
A: 浏览器出于安全考虑，对 `file://` 协议的 localStorage 有严格限制。

### Q: 端口 8000 被占用怎么办？
A: 修改启动脚本中的 `PORT=8000` 为其他端口，如 `PORT=8080`

### Q: 没有 Python 怎么办？
A: 
- 下载安装 Python: https://www.python.org/downloads/
- 或使用 VS Code Live Server 扩展
- 或安装 Node.js 使用 http-server

## 调试工具

如果仍有问题，打开 `debug-login.html` 查看详细的登录状态信息。
