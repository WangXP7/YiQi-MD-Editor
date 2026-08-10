# -*- coding: utf-8 -*-
"""YiQi@MD-Editor-wb-KimiK3 · Markdown 编辑器 —— pywebview 桌面壳。

通过 PyInstaller 打包为单文件 exe（--add-data "web;web"）。
开发态直接 ``python main.py [file.md]`` 运行；
``--check`` 仅验证初始化（构建窗口对象），不启动 GUI 事件循环。
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys

import webview

APP_NAME = "YiQi@MD-Editor-wb-KimiK3"
APP_VERSION = "v1.0.0"
WINDOW_TITLE = f"{APP_NAME} {APP_VERSION}"
TEXT_EXTS = (".md", ".markdown", ".txt", ".mdown", ".mkd")


def resource_path(rel: str) -> str:
    """兼容开发环境与 PyInstaller 打包后（sys._MEIPASS）的资源定位。"""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


def read_text(path: str) -> str:
    """读取文本文件，依次尝试 utf-8 / gbk，最后容错解码。"""
    for enc in ("utf-8", "gbk"):
        try:
            with open(path, "r", encoding=enc) as fh:
                return fh.read()
        except UnicodeDecodeError:
            continue
    with open(path, "rb") as fh:
        return fh.read().decode("utf-8", errors="replace")


def write_text(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(content)


class JsApi:
    """暴露给前端 JS 的桥接 API。"""

    def __init__(self) -> None:
        self._window = None
        self._initial: dict = {}

    # ---- 内部装配 ----------------------------------------------------
    def attach(self, window) -> None:
        self._window = window

    def set_initial(self, path: str) -> None:
        self._initial = self._read_payload(path)

    @staticmethod
    def _read_payload(path: str) -> dict:
        path = os.path.abspath(path)
        return {
            "path": path,
            "content": read_text(path),
            "baseDir": os.path.dirname(path),
            "fileName": os.path.basename(path),
        }

    # ---- 前端可调用的接口 --------------------------------------------
    def get_initial(self) -> dict:
        """返回启动参数自动打开的文件载荷；无则空 dict。"""
        return self._initial or {}

    def open_file_dialog(self) -> dict:
        """系统对话框选择并读取 Markdown 文件，返回 {path, content, baseDir, fileName}。"""
        if self._window is None:
            return {"error": "window not ready"}
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=(
                "Markdown 文件 (*.md;*.markdown;*.txt;*.mdown;*.mkd)",
                "所有文件 (*.*)",
            ),
        )
        if not result:
            return {}
        path = result[0] if isinstance(result, (list, tuple)) else result
        return self.read_path(path)

    def read_path(self, path: str) -> dict:
        """按路径读取文件（拖拽 / 命令行打开用），兼容 utf-8/gbk。"""
        if not path:
            return {}
        path = os.path.abspath(path)
        if not os.path.isfile(path):
            return {"error": f"文件不存在: {path}"}
        try:
            return self._read_payload(path)
        except OSError as exc:
            return {"error": f"读取失败: {exc}"}

    def save_file(self, path: str, content: str) -> dict:
        """按既有路径保存。"""
        try:
            write_text(path, content)
            return {"ok": True, "path": path}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    def save_file_dialog(self, content: str, suggested_name: str = "未命名.md") -> dict:
        """另存为对话框。"""
        if self._window is None:
            return {"ok": False, "error": "window not ready"}
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=suggested_name or "未命名.md",
            file_types=("Markdown 文件 (*.md)", "所有文件 (*.*)"),
        )
        if not result:
            return {"ok": False, "canceled": True}
        path = result[0] if isinstance(result, (list, tuple)) else result
        if not os.path.splitext(path)[1]:
            path += ".md"
        res = self.save_file(path, content)
        if res.get("ok"):
            res["baseDir"] = os.path.dirname(os.path.abspath(path))
            res["fileName"] = os.path.basename(path)
        return res

    def export_html(self, html_content: str, suggested_name: str = "导出.html") -> dict:
        """导出自包含 HTML；KaTeX 字体目录同步复制到导出文件旁（fonts/）。"""
        if self._window is None:
            return {"ok": False, "error": "window not ready"}
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=suggested_name or "导出.html",
            file_types=("HTML 文件 (*.html)",),
        )
        if not result:
            return {"ok": False, "canceled": True}
        path = result[0] if isinstance(result, (list, tuple)) else result
        if not path.lower().endswith((".html", ".htm")):
            path += ".html"
        try:
            write_text(path, html_content)
            src_fonts = resource_path(os.path.join("web", "vendor", "katex", "fonts"))
            dst_fonts = os.path.join(os.path.dirname(path), "fonts")
            if os.path.isdir(src_fonts) and not os.path.isdir(dst_fonts):
                shutil.copytree(src_fonts, dst_fonts)
            return {"ok": True, "path": path}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    def get_static(self, rel_path: str) -> str:
        """读取内置静态资源文本（导出 HTML 时用于内联样式）。"""
        safe = rel_path.replace("\\", "/").lstrip("/")
        if ".." in safe.split("/"):
            return ""
        full = resource_path(safe)
        if not os.path.isfile(full):
            return ""
        return read_text(full)

    def set_title(self, file_name: str, modified: bool = False) -> None:
        """窗口标题显示「文件名 ● - YiQi@MD-Editor-wb-KimiK3 v1.0.0」。"""
        if self._window is None:
            return
        if file_name:
            star = " ●" if modified else ""
            self._window.title = f"{file_name}{star} - {WINDOW_TITLE}"
        else:
            self._window.title = WINDOW_TITLE


def parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YiQi@MD-Editor-wb-KimiK3 · Markdown 编辑器")
    parser.add_argument("file", nargs="?", help="启动时自动打开的 Markdown 文件路径")
    parser.add_argument(
        "--check",
        action="store_true",
        help="仅验证初始化（构建窗口对象），不启动 GUI 事件循环",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)

    api = JsApi()
    if args.file:
        candidate = os.path.abspath(args.file)
        if os.path.isfile(candidate):
            api.set_initial(candidate)
        else:
            print(f"[{APP_NAME}] 启动参数文件不存在，忽略: {candidate}", file=sys.stderr)

    window = webview.create_window(
        WINDOW_TITLE,
        resource_path(os.path.join("web", "index.html")),
        js_api=api,
        width=1400,
        height=900,
        min_size=(960, 600),
    )
    api.attach(window)

    if args.check:
        print(f"INIT OK: 窗口标题「{window.title}」；--check 模式不启动事件循环")
        return 0

    webview.start(debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
