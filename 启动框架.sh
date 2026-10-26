#!/bin/sh
# 儿童互动学习网页框架 · 本地启动脚本（macOS / Linux）
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo ""
echo "  ============================================"
echo "   儿童互动学习网页框架 · 本地服务已启动"
echo "  ============================================"
echo "   门户页面：    http://localhost:$PORT/index.html"
echo "   内容编辑器：  http://localhost:$PORT/editor/editor.html"
echo "   学生学习页：  http://localhost:$PORT/play.html"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""
( sleep 1; (open "http://localhost:$PORT/index.html" 2>/dev/null || xdg-open "http://localhost:$PORT/index.html" 2>/dev/null) ) &
python3 -m http.server "$PORT" || python -m http.server "$PORT"
