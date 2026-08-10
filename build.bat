@echo off
echo ============================================
echo   MD Editor Pro - Build Script
echo ============================================
echo.

REM Activate venv and build
call "C:\Users\xp772\.workbuddy\binaries\python\envs\md-editor\Scripts\activate.bat"

echo [1/2] Cleaning previous build...
if exist build rmdir /S /Q build
if exist dist rmdir /S /Q dist

echo [2/2] Building with PyInstaller...
pyinstaller --clean --noconfirm md-editor.spec

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   Build SUCCESS!
    echo   Output: dist\MD-Editor-Pro\MD-Editor-Pro.exe
    echo ============================================
    start dist\MD-Editor-Pro
) else (
    echo.
    echo ============================================
    echo   Build FAILED! Check errors above.
    echo ============================================
)

pause
