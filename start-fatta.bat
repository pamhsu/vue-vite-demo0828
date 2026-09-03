@echo off
setlocal
title FATTA A MANO - Launcher
cd /d "%~dp0"

echo.
echo ========================================
echo   FATTA A MANO - Project Launcher
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install the LTS version from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available. Reinstall Node.js LTS and try again.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Run this batch file from the downloaded project folder.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] First run detected. Installing project packages...
  call npm ci
  if errorlevel 1 (
    echo [ERROR] Package installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
) else (
  echo [INFO] Project packages already installed. Skipping installation.
)

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example.
    echo [ACTION] Check .env has the correct MySQL settings before using the site.
  ) else (
    echo [ERROR] .env and .env.example were not found.
    pause
    exit /b 1
  )
)

echo.
echo Starting API server and Vite frontend in separate windows...
echo Keep both new windows open while using the project.
echo.

start "FATTA API Server" cmd /k "npm run server"
start "FATTA Frontend" cmd /k "npm run dev"

echo The frontend will usually be available at http://localhost:5173
echo If that port is occupied, Vite will show a different localhost address.
echo.
pause
