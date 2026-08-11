"""Build the compact single-file Windows executable."""

from pathlib import Path

import PyInstaller.__main__


ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.1.3"
NAME = f"YiQi@MD-Editor-GPT5.6SolxHigh-v{VERSION}-Lite-WebView2-x64"


def main() -> None:
    PyInstaller.__main__.run(
        [
            str(ROOT / "compact" / "main.py"),
            "--noconfirm",
            "--clean",
            "--onefile",
            "--windowed",
            f"--name={NAME}",
            f"--icon={ROOT / 'build' / 'icon.ico'}",
            f"--version-file={ROOT / 'compact' / 'version_info.txt'}",
            f"--add-data={ROOT / 'dist'};dist",
            "--hidden-import=webview.platforms.edgechromium",
            "--hidden-import=webview.platforms.winforms",
            "--exclude-module=webview.platforms.cef",
            "--exclude-module=webview.platforms.qt",
            "--exclude-module=webview.platforms.gtk",
            "--exclude-module=webview.platforms.cocoa",
            "--exclude-module=tkinter",
            "--exclude-module=test",
            "--exclude-module=unittest",
            f"--distpath={ROOT / 'release'}",
            f"--workpath={ROOT / 'build' / 'pyinstaller-lite'}",
            f"--specpath={ROOT / 'compact'}",
        ]
    )


if __name__ == "__main__":
    main()
