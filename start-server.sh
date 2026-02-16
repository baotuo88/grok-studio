#!/bin/bash

# Grok Studio 本地服务器启动脚本

echo "🚀 启动 Grok Studio 本地服务器..."
echo ""

# 检测可用的 Python 版本
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ 错误：未找到 Python"
    echo "请先安装 Python: https://www.python.org/downloads/"
    exit 1
fi

# 获取 Python 版本
PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
echo "✅ 找到 Python $PYTHON_VERSION"
echo ""

# 选择端口
PORT=8000
echo "📡 服务器将在端口 $PORT 启动"
echo ""

# 启动服务器
echo "🌐 访问地址: http://localhost:$PORT"
echo "📝 按 Ctrl+C 停止服务器"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 根据 Python 版本选择命令
if [[ $PYTHON_VERSION == 3.* ]]; then
    $PYTHON_CMD -m http.server $PORT
else
    $PYTHON_CMD -m SimpleHTTPServer $PORT
fi
