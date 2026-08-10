#!/usr/bin/env python3
"""
YiQi@MD-Editor-wb-DSv4-Pro v1.0
A beautiful standalone Markdown editor for Windows — native window via Edge WebView2.
"""

import sys
import os
import json
import webview
import chardet
from pathlib import Path

VERSION = "1.0"
APP_NAME = "YiQi@MD-Editor-wb-DSv4-Pro"

# ── Path resolution (works for both dev and PyInstaller frozen exe) ──
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TEMPLATE_PATH = os.path.join(BASE_DIR, 'templates', 'index.html')


# ── JS Bridge: Python functions exposed to JavaScript ───────────────
class Api:
    """All methods called from JS via window.pywebview.api.* return JSON strings."""

    def open_file(self):
        """Show native Open dialog and return file content + metadata."""
        result = window.create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=(
                'Markdown Files (*.md;*.markdown;*.mdown;*.mkd)',
                'Text Files (*.txt)',
                'All Files (*.*)',
            ),
            allow_multiple=False,
        )
        if not result:
            return json.dumps({'success': False, 'cancelled': True})

        path = result[0] if isinstance(result, (list, tuple)) else result
        try:
            raw = Path(path).read_bytes()
            detected = chardet.detect(raw)
            encoding = detected.get('encoding', 'utf-8') or 'utf-8'
            content = raw.decode(encoding, errors='replace')
            return json.dumps({
                'success': True,
                'content': content,
                'path': str(Path(path).absolute()),
                'name': Path(path).name,
                'encoding': encoding,
            })
        except Exception as e:
            return json.dumps({'success': False, 'error': str(e)})

    def save_file(self, path, content):
        """Save content to a file path."""
        try:
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding='utf-8')
            return json.dumps({
                'success': True,
                'path': str(p.absolute()),
                'name': p.name,
            })
        except Exception as e:
            return json.dumps({'success': False, 'error': str(e)})

    def save_file_dialog(self, default_name):
        """Show native Save As dialog and return selected path."""
        result = window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=default_name or 'untitled.md',
            file_types=('Markdown Files (*.md;*.markdown)',),
        )
        if result:
            return result if isinstance(result, str) else result[0]
        return ''

    def export_html_dialog(self, default_name):
        """Show native Save dialog for HTML export."""
        result = window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=default_name or 'export.html',
            file_types=('HTML Files (*.html;*.htm)',),
        )
        if result:
            return result if isinstance(result, str) else result[0]
        return ''

    def export_html(self, path, html):
        """Write HTML export."""
        try:
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(html, encoding='utf-8')
            return json.dumps({'success': True, 'path': str(p.absolute())})
        except Exception as e:
            return json.dumps({'success': False, 'error': str(e)})

    def load_file(self, path):
        """Load a specific file path (used for drag-and-drop and recent files)."""
        try:
            p = Path(path)
            if not p.exists() or not p.is_file():
                return json.dumps({'success': False, 'error': 'File not found'})
            raw = p.read_bytes()
            detected = chardet.detect(raw)
            encoding = detected.get('encoding', 'utf-8') or 'utf-8'
            content = raw.decode(encoding, errors='replace')
            return json.dumps({
                'success': True,
                'content': content,
                'path': str(p.absolute()),
                'name': p.name,
                'encoding': encoding,
            })
        except Exception as e:
            return json.dumps({'success': False, 'error': str(e)})

    def get_version(self):
        """Return app version."""  
        return VERSION

    def quit_app(self):
        """Gracefully close the window."""
        window.destroy()
        return json.dumps({'success': True})

    def log(self, msg):
        """Print a log message from JS to Python stdout."""
        print(f'[JS] {msg}')
        return ''


# ── Main entry ──────────────────────────────────────────────────────
def main():
    global window

    api = Api()

    window = webview.create_window(
        title=f'{APP_NAME} v{VERSION}',
        url=f'file:///{TEMPLATE_PATH.replace(os.sep, "/")}',
        width=1400,
        height=900,
        min_size=(900, 600),
        js_api=api,
        text_select=True,
        background_color='#1a1a2e',
        easy_drag=False,
    )

    webview.start(debug=False, gui='edgechromium')


if __name__ == '__main__':
    main()