@echo off
chcp 65001 >nul
cd /d %~dp0
echo.
echo  ============================================
echo   儿童互动学习网页框架 · 本地服务已启动
echo  ============================================
echo   门户页面：    http://localhost:8000/index.html
echo   内容编辑器：  http://localhost:8000/editor/editor.html
echo   学生学习页：  http://localhost:8000/play.html
echo.
echo   关闭此窗口即可停止服务
echo.
start "" http://localhost:8000/index.html
where python >nul 2>nul && (python -m http.server 8000) || (py -m http.server 8000)
pause
