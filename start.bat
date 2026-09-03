@echo off
chcp 65001 >nul
title 九尾狐 · 启动器
echo ========================================
echo    九尾狐 · 短剧 AI 生产工作台
echo ========================================
echo.

set "ROOT=E:\AIMovie\AIMovieWorkSpace\nine_tailed_fox"
set "COMFY=H:\ComfyUI\ComfyUI-V18.1"

echo [1/4] 启动后端 server (3000)...
start "九尾狐-后端(3000)" cmd /k "cd /d %ROOT% && pnpm --filter @fox/server dev"

echo [2/4] 启动 AI 服务 (8001)...
start "九尾狐-AI(8001)" cmd /k "cd /d %ROOT%\apps\ai && conda run -n langchain python -m uvicorn main:app --port 8001"

echo [3/4] 启动前端 web (5173)...
start "九尾狐-前端(5173)" cmd /k "cd /d %ROOT% && pnpm --filter @fox/web dev"

echo [4/4] 启动 ComfyUI (8188)...
start "ComfyUI(8188)" cmd /k "cd /d %COMFY% && python\python.exe main.py"

echo.
echo 等待服务就绪，10 秒后自动打开浏览器...
timeout /t 10 /nobreak >nul
start http://localhost:5173
echo.
echo 已打开浏览器。本窗口可关闭，各服务在独立窗口运行。
pause
