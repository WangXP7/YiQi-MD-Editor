# -*- coding: utf-8 -*-
"""
YiQi@MD-Editor-千问办公-Qwen3.8-Max v1.0.0
Windows 独立 Markdown 编辑器 · 主程序
内核：pywebview (WebView2) + markdown-it 前端渲染
"""
import base64
import os
import re
import sys
import webview

APP_NAME = "YiQi@MD-Editor-千问办公-Qwen3.8-Max"
APP_VERSION = "1.0.0"
FULL_TITLE = "%s v%s" % (APP_NAME, APP_VERSION)

MD_TYPES = ("Markdown 文件 (*.md;*.markdown;*.mdown;*.txt)", "所有文件 (*.*)")
HTML_TYPES = ("HTML 文件 (*.html)", "所有文件 (*.*)")


def base_dir():
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


WEB_DIR = os.path.join(base_dir(), "web")

MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".bmp": "image/bmp", ".ico": "image/x-icon",
}


class Api:
    """暴露给前端 JS 的 Python API"""

    def __init__(self):
        self.window = None

    # ---------- 元信息 ----------
    def get_meta(self):
        return {"name": APP_NAME, "version": APP_VERSION, "title": FULL_TITLE}

    def get_welcome(self):
        try:
            with open(os.path.join(WEB_DIR, "welcome.md"), "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def set_title(self, text):
        try:
            if self.window is not None:
                self.window.title = text
        except Exception:
            pass

    # ---------- 文件对话框 ----------
    def open_dialog(self):
        result = self.window.create_file_dialog(
            webview.OPEN_DIALOG, file_types=MD_TYPES)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    def save_dialog(self, default_name="未命名文档.md"):
        result = self.window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=MD_TYPES if not default_name.endswith(".html") else HTML_TYPES)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    # ---------- 读写文件 ----------
    def read_file(self, path):
        try:
            raw = open(path, "rb").read()
        except Exception as e:
            return {"ok": False, "error": str(e)}
        content, encoding = None, None
        for enc in ("utf-8-sig", "utf-8", "gb18030", "big5", "latin-1"):
            try:
                content = raw.decode(enc)
                encoding = enc
                break
            except Exception:
                continue
        if content is None:
            return {"ok": False, "error": "无法识别的文件编码"}
        return {"ok": True, "content": content,
                "encoding": encoding.replace("-sig", "").upper()}

    def write_file(self, path, content):
        try:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(content)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ---------- 图片本地路径 → data URI ----------
    def image_data_uri(self, base, src):
        try:
            src = src.replace("file:///", "").replace("file://", "")
            src = src.replace("/", os.sep)
            if os.path.isabs(src):
                p = os.path.abspath(src)
            else:
                p = os.path.abspath(os.path.join(base or "", src))
            if not os.path.isfile(p) or os.path.getsize(p) > 20 * 1024 * 1024:
                return None
            ext = os.path.splitext(p)[1].lower()
            mime = MIME.get(ext, "application/octet-stream")
            with open(p, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            return "data:%s;base64,%s" % (mime, b64)
        except Exception:
            return None

    # ---------- 外部链接 / 本地文件 ----------
    def open_external(self, url):
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            pass

    def open_local(self, href, base):
        try:
            href = href.split("#")[0]
            if not os.path.isabs(href):
                href = os.path.abspath(os.path.join(base or "", href))
            if os.path.isfile(href) and href.lower().endswith(
                    (".md", ".markdown", ".mdown", ".txt")):
                r = self.read_file(href)
                if r.get("ok"):
                    self.window.evaluate_js(
                        "window.__loadExternal && window.__loadExternal(%s, %s)"
                        % (json_dumps(href), json_dumps(r["content"])))
                return
            os.startfile(href)  # noqa: S606 (Windows)
        except Exception:
            pass

    # ---------- 导出独立 HTML ----------
    def export_html(self, path, body_html, theme, title):
        try:
            css_parts = []
            # KaTeX 样式（字体内嵌为 base64，保证离线可用）
            katex_css = _read(os.path.join(WEB_DIR, "vendor", "katex", "katex.min.css"))
            fonts_dir = os.path.join(WEB_DIR, "vendor", "katex", "fonts")

            def _embed(m):
                name = m.group(1).split("?")[0].split("#")[0]
                fp = os.path.join(fonts_dir, name)
                if not os.path.isfile(fp):
                    return m.group(0)
                ext = os.path.splitext(name)[1].lower()
                fm = {".woff2": "font/woff2", ".woff": "font/woff",
                      ".ttf": "font/ttf"}.get(ext, "application/octet-stream")
                with open(fp, "rb") as f:
                    return "url(data:%s;base64,%s)" % (
                        fm, base64.b64encode(f.read()).decode("ascii"))

            katex_css = re.sub(r"url\(fonts/([^)]+)\)", _embed, katex_css)
            css_parts.append(katex_css)
            css_parts.append(_read(os.path.join(WEB_DIR, "vendor", "texmath.css")))
            hljs_name = "github-dark.min.css" if theme == "dark" else "github.min.css"
            css_parts.append(_read(os.path.join(WEB_DIR, "vendor", hljs_name)))
            css_parts.append(_EXPORT_CSS)

            html = (
                "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n"
                "<meta charset=\"UTF-8\">\n"
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
                "<title>%s</title>\n<style>\n%s\n</style>\n</head>\n<body>\n"
                "<article class=\"preview\">\n%s\n</article>\n"
                "<footer style=\"text-align:center;color:#888;font-size:12px;"
                "padding:24px 0\">由 %s 导出</footer>\n</body>\n</html>"
                % (escape(title), "\n".join(css_parts), body_html, FULL_TITLE)
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            return {"ok": True, "path": path}
        except Exception as e:
            return {"ok": False, "error": str(e)}


def _read(p):
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def escape(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def json_dumps(s):
    import json
    return json.dumps(s, ensure_ascii=False)


_EXPORT_CSS = """
body{margin:0;background:#fff;color:#24292f;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
.preview{max-width:920px;margin:0 auto;padding:36px 44px;line-height:1.8;font-size:15px;word-wrap:break-word}
.preview h1,.preview h2{border-bottom:1px solid #dfe3ee;padding-bottom:.3em}
.preview h1{font-size:1.9em}.preview h2{font-size:1.5em}
.preview blockquote{border-left:4px solid #8b7cf7;background:#f6f6fb;margin:1em 0;padding:10px 18px;border-radius:0 10px 10px 0;color:#57606a}
.preview code{background:#f2f3f8;border:1px solid #e2e5ee;border-radius:6px;padding:2px 6px;font-size:.88em;color:#b3318e;font-family:Consolas,"Microsoft YaHei",monospace}
.preview pre code{background:transparent;border:0;padding:0;color:inherit}
.codeblock{border:1px solid #e2e5ee;border-radius:12px;overflow:hidden;margin:1em 0;background:#f8f9fc}
.codeblock .cb-head{display:flex;justify-content:space-between;padding:6px 14px;background:#eef0f7;border-bottom:1px solid #e2e5ee;font-size:11.5px;color:#6b7280;text-transform:uppercase;letter-spacing:1px}
.codeblock pre{margin:0;padding:14px 16px;overflow:auto;line-height:1.65}
.codeblock .cb-copy{display:none}
.preview table{border-collapse:collapse}
.preview th,.preview td{border:1px solid #dfe3ee;padding:7px 14px}
.preview th{background:#eef0f7}
.preview img{max-width:100%;border-radius:10px}
.preview hr{border:0;height:2px;background:linear-gradient(90deg,transparent,#8b7cf7,transparent)}
.admonition{margin:1em 0;padding:12px 18px;border-radius:12px;border:1px solid;border-left-width:5px}
.admonition.note{border-color:#4f9cf9;background:rgba(79,156,249,.08)}
.admonition.info{border-color:#22c1dc;background:rgba(34,193,220,.08)}
.admonition.tip{border-color:#3ddc84;background:rgba(61,220,132,.09)}
.admonition.warning{border-color:#f5a623;background:rgba(245,166,35,.09)}
.admonition.danger{border-color:#f0506e;background:rgba(240,80,110,.09)}
.mermaid-wrap{margin:1em 0;padding:18px;border:1px solid #e2e5ee;border-radius:12px;text-align:center}
mark{background:rgba(232,194,104,.7);padding:0 4px;border-radius:4px}
li.task-list-item{list-style:none}
.fm-panel{border:1px dashed #dfe3ee;border-radius:12px;padding:12px 18px;background:#fafbff;color:#57606a;font-size:.88em;margin-bottom:1.4em}
.fm-panel td{border:0;padding:2px 12px 2px 0}
"""


def main():
    api = Api()
    window = webview.create_window(
        FULL_TITLE,
        url=os.path.join(WEB_DIR, "index.html"),
        js_api=api,
        width=1360,
        height=880,
        min_size=(960, 620),
        background_color="#10121a",
        text_select=True,
        easy_drag=False,
    )
    api.window = window
    webview.start(debug=False, gui="edgechromium")


if __name__ == "__main__":
    main()
