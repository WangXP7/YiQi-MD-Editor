"""YiQi@MD-Editor compact Windows shell powered by the system WebView2 runtime."""

from __future__ import annotations

import base64
import ctypes
import html
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import webview


APP_NAME = "YiQi@MD-Editor-GPT5.6SolxHigh"
APP_VERSION = "1.1.3"
PRODUCT_NAME = f"{APP_NAME}-v{APP_VERSION}-Lite-WebView2"
MARKDOWN_TYPES = (
    "Markdown 文档 (*.md;*.markdown;*.mdown;*.mkd)",
    "文本文件 (*.txt)",
    "所有文件 (*.*)",
)
HTML_TYPES = ("HTML 网页 (*.html)", "所有文件 (*.*)")
PDF_TYPES = ("PDF 文档 (*.pdf)", "所有文件 (*.*)")


def resource_root() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))


def decode_text(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "big5", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def file_result(file_path: str) -> dict:
    path = Path(file_path)
    return {
        "canceled": False,
        "filePath": str(path),
        "name": path.name,
        "content": decode_text(path.read_bytes()),
    }


class CompactApi:
    def __init__(self, pending_files: list[str]):
        self.window = None
        self.pending_files = pending_files
        self.force_closing = False

    def _emit(self, expression: str) -> None:
        if self.window is None:
            return
        try:
            self.window.evaluate_js(expression)
        except Exception:
            pass

    def _save_dialog(self, default_name: str, file_types: tuple[str, ...]) -> str | None:
        result = self.window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=file_types,
        )
        if not result:
            return None
        return str(result[0] if isinstance(result, (tuple, list)) else result)

    def open_file(self) -> dict:
        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=True,
                file_types=MARKDOWN_TYPES,
            )
            if not result:
                return {"canceled": True}
            paths = result if isinstance(result, (tuple, list)) else (result,)
            return {"canceled": False, "files": [file_result(str(path)) for path in paths]}
        except Exception as error:
            return {"canceled": True, "error": str(error)}

    def read_file(self, file_path: str) -> dict:
        try:
            return file_result(file_path)
        except Exception as error:
            return {"canceled": True, "error": str(error)}

    def save_file(self, payload: dict) -> dict:
        try:
            file_path = str(payload.get("filePath") or "")
            Path(file_path).write_text(str(payload.get("content") or ""), encoding="utf-8", newline="")
            return {"canceled": False, "filePath": file_path, "name": Path(file_path).name}
        except Exception as error:
            return {"canceled": True, "error": str(error)}

    def save_file_as(self, payload: dict) -> dict:
        file_path = self._save_dialog(str(payload.get("defaultName") or "未命名.md"), MARKDOWN_TYPES)
        if not file_path:
            return {"canceled": True}
        if not Path(file_path).suffix:
            file_path += ".md"
        return self.save_file({"filePath": file_path, "content": payload.get("content") or ""})

    def confirm_unsaved(self, name: str) -> int:
        message_box = ctypes.windll.user32.MessageBoxW
        result = message_box(
            None,
            f"{name or '当前文档'}包含未保存的修改。\n\n是否先保存这些修改？",
            "尚未保存",
            0x00000003 | 0x00000030,
        )
        return {6: 0, 7: 1}.get(result, 2)

    def export_html(self, payload: dict) -> dict:
        title = str(payload.get("title") or "document")
        file_path = self._save_dialog(f"{title}.html", HTML_TYPES)
        if not file_path:
            return {"canceled": True}
        if not Path(file_path).suffix:
            file_path += ".html"
        try:
            page = self._export_page(payload)
            Path(file_path).write_text(page, encoding="utf-8", newline="")
            return {"canceled": False, "filePath": file_path}
        except Exception as error:
            return {"canceled": True, "error": str(error)}

    def export_pdf(self, payload: dict) -> dict:
        title = str(payload.get("title") or "document")
        file_path = self._save_dialog(f"{title}.pdf", PDF_TYPES)
        if not file_path:
            return {"canceled": True}
        if not Path(file_path).suffix:
            file_path += ".pdf"
        try:
            self._print_html_to_pdf(self._export_page(payload), file_path)
            return {"canceled": False, "filePath": file_path}
        except Exception as error:
            return {"canceled": True, "error": str(error)}

    @staticmethod
    def _export_page(payload: dict) -> str:
        title = html.escape(str(payload.get("title") or "Markdown"))
        css = str(payload.get("css") or "")
        body = str(payload.get("html") or "")
        return (
            "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            f"<title>{title}</title><style>{css}"
            "body{background:#fff!important;padding:0!important}"
            ".markdown-body{max-width:none!important;box-shadow:none!important}"
            "</style></head><body><article class=\"markdown-body\">"
            f"{body}</article></body></html>"
        )

    @staticmethod
    def _print_html_to_pdf(page: str, file_path: str) -> None:
        print_window = webview.create_window(
            "YiQi PDF",
            html=page,
            width=900,
            height=700,
            hidden=True,
            text_select=True,
        )
        try:
            if not print_window.events.loaded.wait(20):
                raise RuntimeError("PDF 渲染超时")

            from System import Action
            from webview.platforms.winforms import BrowserView

            form = BrowserView.instances[print_window.uid]
            task_holder = []

            def start_print():
                task_holder.append(form.browser.web_view.CoreWebView2.PrintToPdfAsync(file_path))

            form.Invoke(Action(start_print))
            if not task_holder or not task_holder[0].Wait(30000) or not bool(task_holder[0].Result):
                raise RuntimeError("WebView2 PDF 导出失败")
        finally:
            try:
                print_window.destroy()
            except Exception:
                pass

    @staticmethod
    def show_item(file_path: str) -> bool:
        try:
            subprocess.Popen(["explorer.exe", "/select,", str(Path(file_path))])
            return True
        except Exception:
            return False

    @staticmethod
    def open_external(url: str) -> bool:
        if not str(url).lower().startswith(("http://", "https://")):
            return False
        try:
            os.startfile(url)
            return True
        except Exception:
            return False

    @staticmethod
    def resolve_asset(payload: dict) -> str:
        source = str(payload.get("source") or "")
        document_path = str(payload.get("documentPath") or "")
        if not source or source.lower().startswith(("http://", "https://", "data:", "file:", "#")):
            return source
        try:
            image_path = Path(source)
            if not image_path.is_absolute():
                image_path = Path(document_path).resolve().parent / image_path
            mime = mimetypes.guess_type(str(image_path))[0] or "application/octet-stream"
            encoded = base64.b64encode(image_path.resolve().read_bytes()).decode("ascii")
            return f"data:{mime};base64,{encoded}"
        except Exception:
            return source

    @staticmethod
    def get_app_info() -> dict:
        return {"version": APP_VERSION, "platform": "win32", "compact": True, "engine": "WebView2"}

    def copy_text(self, text: str) -> bool:
        from System import Action
        from System.Windows.Forms import Clipboard
        from webview.platforms.winforms import BrowserView

        form = BrowserView.instances[self.window.uid]
        form.Invoke(Action(lambda: Clipboard.SetText(str(text))))
        return True

    def minimize(self) -> bool:
        self.window.minimize()
        return True

    def toggle_maximize(self) -> bool:
        from System import Action
        from System.Windows.Forms import FormWindowState
        from webview.platforms.winforms import BrowserView

        form = BrowserView.instances[self.window.uid]
        maximized = form.WindowState == FormWindowState.Maximized
        form.Invoke(Action(lambda: setattr(
            form,
            "WindowState",
            FormWindowState.Normal if maximized else FormWindowState.Maximized,
        )))
        return not maximized

    def force_close(self) -> bool:
        self.force_closing = True
        self.window.destroy()
        return True

    def on_loaded(self) -> None:
        for file_path in self.pending_files:
            self._emit(f"window.__yiqiCompact?.emitOpenFile({json.dumps(file_path, ensure_ascii=False)})")
        self.pending_files.clear()
        self._install_native_drop()

    def on_closing(self) -> bool:
        if self.force_closing:
            return True
        self._emit("window.__yiqiCompact?.requestClose()")
        return False

    def on_maximized(self) -> None:
        self._emit("window.__yiqiCompact?.emitMaximized(true)")

    def on_restored(self) -> None:
        self._emit("window.__yiqiCompact?.emitMaximized(false)")

    def _install_native_drop(self) -> None:
        try:
            from System import Action
            from System.Windows.Forms import DataFormats, DragDropEffects
            from webview.platforms.winforms import BrowserView

            form = BrowserView.instances[self.window.uid]

            def drag_enter(_sender, event):
                if event.Data.GetDataPresent(DataFormats.FileDrop):
                    event.Effect = DragDropEffects.Copy

            def drag_drop(_sender, event):
                paths = event.Data.GetData(DataFormats.FileDrop)
                for item in paths or []:
                    file_path = str(item)
                    if Path(file_path).suffix.lower() in {".md", ".markdown", ".mdown", ".mkd", ".txt"}:
                        threading.Thread(
                            target=self._emit,
                            args=(f"window.__yiqiCompact?.emitOpenFile({json.dumps(file_path, ensure_ascii=False)})",),
                            daemon=True,
                        ).start()

            def configure_drop():
                form.AllowDrop = True
                form.DragEnter += drag_enter
                form.DragDrop += drag_drop

            form.Invoke(Action(configure_drop))
        except Exception:
            pass


def markdown_args() -> list[str]:
    extensions = {".md", ".markdown", ".mdown", ".mkd", ".txt"}
    return [str(Path(arg).resolve()) for arg in sys.argv[1:] if Path(arg).is_file() and Path(arg).suffix.lower() in extensions]


def main() -> None:
    smoke_test = os.environ.get("YIQI_SMOKE_TEST") == "1"
    api = CompactApi(markdown_args())
    index_path = resource_root() / "dist" / "index.html"
    window = webview.create_window(
        PRODUCT_NAME,
        url=str(index_path),
        js_api=api,
        width=1480,
        height=940,
        min_size=(980, 640),
        frameless=True,
        easy_drag=True,
        background_color="#080b14",
        text_select=True,
        hidden=smoke_test,
    )
    api.window = window
    window.events.loaded += api.on_loaded
    window.events.closing += api.on_closing
    window.events.maximized += api.on_maximized
    window.events.restored += api.on_restored

    storage_path = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "YiQi-MD-Editor-GPT5.6SolxHigh-Lite"
    storage_path.mkdir(parents=True, exist_ok=True)

    def run_smoke_test() -> None:
        marker_value = os.environ.get("YIQI_SMOKE_MARKER")
        marker_path = Path(marker_value).resolve() if marker_value else None
        result: dict = {"ok": False, "version": APP_VERSION, "engine": "WebView2"}
        try:
            if not window.events.loaded.wait(30):
                raise RuntimeError("主界面加载超时")
            time.sleep(3)
            page_state = window.evaluate_js(
                """
                (() => ({
                  title: document.title,
                  bridge: Boolean(window.yiqiMd && window.pywebview?.api),
                  editor: Boolean(document.querySelector('.cm-editor')),
                  preview: Boolean(document.querySelector('#preview')),
                  tabs: document.querySelectorAll('.document-tab').length,
                  activeTab: document.querySelector('.document-tab.active .document-tab-name')?.textContent,
                  toolbarButtons: document.querySelectorAll('.format-toolbar button').length,
                  copyButtons: document.querySelectorAll('.block-copy-button').length,
                  searchButtonFont: getComputedStyle(document.querySelector('#search-button')).fontSize
                }))()
                """
            )
            result.update({"ok": bool(page_state and page_state.get("bridge")), "page": page_state})

            pdf_value = os.environ.get("YIQI_SMOKE_PDF")
            if pdf_value:
                pdf_path = str(Path(pdf_value).resolve())
                api._print_html_to_pdf(
                    api._export_page({"title": "YiQi Smoke Test", "html": "<h1>YiQi WebView2 OK</h1>", "css": ""}),
                    pdf_path,
                )
                result["pdf"] = {"path": pdf_path, "bytes": Path(pdf_path).stat().st_size}
        except Exception as error:
            result["error"] = str(error)
        finally:
            if marker_path:
                marker_path.parent.mkdir(parents=True, exist_ok=True)
                marker_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            api.force_closing = True
            try:
                window.destroy()
            except Exception:
                pass

    try:
        webview.start(
            func=run_smoke_test if smoke_test else None,
            gui="edgechromium",
            debug=False,
            private_mode=False,
            storage_path=str(storage_path),
            user_agent=f"YiQiCompact/{APP_VERSION}",
        )
    except Exception as error:
        if smoke_test:
            raise
        ctypes.windll.user32.MessageBoxW(
            None,
            "轻量版需要 Microsoft Edge WebView2 Runtime。\n\n"
            "请先安装或修复 WebView2 Runtime，再重新启动应用。\n\n"
            f"详细信息：{error}",
            f"{PRODUCT_NAME} 无法启动",
            0x00000010,
        )


if __name__ == "__main__":
    main()
