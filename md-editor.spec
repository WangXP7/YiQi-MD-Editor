# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for YiQi@MD-Editor-wb-DSv4-Pro v1.0 (pywebview edition) - ONEFILE mode
Generates a single standalone .exe with everything bundled inside.
"""

import sys
import os

block_cipher = None

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=[
        'webview',
        'webview.platforms.winforms',
        'webview.platforms.edgechromium',
        'clr_loader',
        'pythonnet',
        'chardet',
        'bottle',
        'proxy_tools',
        'win32com',
        'win32com.client',
        'win32gui',
        'win32api',
        'win32con',
        'win32process',
        'win32event',
        'win32clipboard',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Onefile mode: bundle everything into a single exe
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,    # binaries embedded in exe
    a.zipfiles,    # zip archives embedded in exe
    a.datas,       # data files embedded in exe
    [],
    name='YiQi-MD-Editor-wb-DSv4-Pro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
# NO COLLECT - this keeps it as a single file