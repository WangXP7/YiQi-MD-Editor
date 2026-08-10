/**
 * YiQi@MD-Editor-wb-KimiK3 · Markdown 编辑器 —— 前端逻辑
 * 三栏布局 / 实时渲染 / 滚动同步 / 明暗主题 / 导出 HTML
 * 纯浏览器脚本（非 ESM），全部依赖通过 vendor 本地化加载。
 */
(function () {
  'use strict';

  /* ================= 全局状态 ================= */
  var state = {
    path: null,          // 当前文件绝对路径（null 表示未保存的新文档）
    fileName: '',
    baseDir: '',         // 图片相对路径基准目录
    modified: false,
    view: 'split',       // edit | split | preview
    theme: localStorage.getItem('molan-theme') || 'dark',
    fontSize: clampFont(parseInt(localStorage.getItem('molan-font-size') || '15', 10)),
    rendering: false
  };

  function clampFont(px) {
    if (isNaN(px)) return 15;
    return Math.min(24, Math.max(12, px));
  }

  /* ================= DOM 引用 ================= */
  var $ = function (id) { return document.getElementById(id); };
  var editor = $('editor');
  var preview = $('preview');
  var tocPanel = $('toc-panel');
  var tocNav = $('toc');
  var searchBar = $('search-bar');
  var searchInput = $('search-input');
  var searchCount = $('search-count');

  /* ================= markdown-it 渲染管线 ================= */
  var md = window.markdownit({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: function (str, lang) {
      if (lang && window.hljs && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch (e) { /* fallthrough */ }
      }
      if (window.hljs) {
        try {
          return hljs.highlightAuto(str).value;
        } catch (e) { /* fallthrough */ }
      }
      return md.utils.escapeHtml(str);
    }
  });

  md.use(window.markdownitTaskLists, { enabled: true, label: true })
    .use(window.markdownitFootnote)
    .use(window.markdownitEmoji)          // full 版
    .use(window.markdownitDeflist)
    .use(window.markdownitAbbr)
    .use(window.markdownitSub)
    .use(window.markdownitSup)
    .use(window.markdownitMark)
    .use(window.markdownitIns)
    .use(window.markdownItAnchor, {
      permalink: false,
      slugify: function (s) {
        return 'h-' + encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, '-'));
      }
    })
    .use(window.markdownItTocDoneRight, {
      containerClass: 'toc',
      listType: 'ul',
      level: [1, 2, 3, 4]
    });

  // 自定义容器：info / tip / warning / danger
  ['info', 'tip', 'warning', 'danger'].forEach(function (name) {
    md.use(window.markdownitContainer, name, {
      render: function (tokens, idx) {
        if (tokens[idx].nesting === 1) {
          var title = tokens[idx].info.trim().slice(name.length).trim();
          return '<div class="custom-block custom-' + name + '">' +
            (title ? '<p class="custom-block-title">' + md.utils.escapeHtml(title) + '</p>' : '');
        }
        return '</div>\n';
      }
    });
  });

  // KaTeX 数学公式（$...$ 与 $$...$$）
  md.use(window.texmath, {
    engine: window.katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false, output: 'html' }
  });

  /* ---- 自定义 fence：mermaid + 代码块复制按钮 ---- */
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    var token = tokens[idx];
    var info = token.info ? token.info.trim() : '';
    var lang = info.split(/\s+/g)[0] || '';

    if (lang === 'mermaid') {
      return '<div class="mermaid-block">' +
        '<div class="mermaid-loading">图表渲染中…</div>' +
        '<pre class="mermaid-source" hidden>' + md.utils.escapeHtml(token.content) + '</pre>' +
        '</div>\n';
    }

    var inner = options.highlight(token.content, lang) || md.utils.escapeHtml(token.content);
    var langLabel = lang
      ? '<span class="code-lang">' + md.utils.escapeHtml(lang) + '</span>'
      : '<span class="code-lang">text</span>';
    return '<div class="code-block">' +
      '<div class="code-head">' + langLabel +
      '<button type="button" class="code-copy">复制</button></div>' +
      '<pre class="hljs"><code>' + inner + '</code></pre>' +
      '</div>\n';
  };

  /* ---- 图片：相对路径基于 md 文件目录转 file:// ---- */
  var defaultImage = md.renderer.rules.image || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    var token = tokens[idx];
    var srcIdx = token.attrIndex('src');
    if (srcIdx >= 0) {
      var src = token.attrs[srcIdx][1];
      // 无协议且非 // 开头 → 相对路径
      if (src && !/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(src) && src.indexOf('//') !== 0) {
        if (state.baseDir) {
          var base = state.baseDir.replace(/\\/g, '/');
          var abs = base + '/' + src;
          token.attrs[srcIdx][1] = 'file:///' + encodeURI(abs).replace(/#/g, '%23').replace(/\?/g, '%3F');
        }
      }
    }
    return defaultImage(tokens, idx, options, env, self);
  };

  /* ---- 外链：target=_blank + ↗ 角标（CSS ::after） ---- */
  var defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    var token = tokens[idx];
    var hrefIdx = token.attrIndex('href');
    var href = hrefIdx >= 0 ? token.attrs[hrefIdx][1] : '';
    if (/^(https?:)?\/\//i.test(href)) {
      token.attrPush(['target', '_blank']);
      token.attrPush(['rel', 'noopener noreferrer']);
      token.attrPush(['class', 'external-link']);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  /* ================= Mermaid ================= */
  var mermaidSeq = 0;
  function initMermaid() {
    if (!window.mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: state.theme === 'dark' ? 'dark' : 'default',
      flowchart: { htmlLabels: true }
    });
  }

  function renderMermaidBlocks() {
    if (!window.mermaid) return;
    var blocks = preview.querySelectorAll('.mermaid-block');
    blocks.forEach(function (block) {
      var srcEl = block.querySelector('.mermaid-source');
      var loadingEl = block.querySelector('.mermaid-loading');
      if (!srcEl || !loadingEl) return;
      var code = srcEl.textContent;
      var id = 'molan-mmd-' + (++mermaidSeq);
      mermaid.render(id, code).then(function (result) {
        var wrap = document.createElement('div');
        wrap.className = 'mermaid-svg';
        wrap.innerHTML = result.svg;
        loadingEl.replaceWith(wrap);
      }).catch(function (err) {
        // 渲染失败：显示源码，不崩溃
        var fail = document.createElement('div');
        fail.className = 'mermaid-fail';
        var note = document.createElement('div');
        note.className = 'mermaid-fail-note';
        note.textContent = 'Mermaid 渲染失败：' + (err && err.message ? err.message : String(err));
        var pre = document.createElement('pre');
        pre.textContent = code;
        fail.appendChild(note);
        fail.appendChild(pre);
        loadingEl.replaceWith(fail);
        // 清理 mermaid 失败时注入的临时节点
        var tmp = document.getElementById('d' + id);
        if (tmp && tmp.parentNode) tmp.parentNode.removeChild(tmp);
      });
    });
  }

  /* ================= 渲染调度（防抖 150ms） ================= */
  var renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 150);
  }

  function renderPreview() {
    if (state.rendering) return;
    state.rendering = true;
    try {
      preview.innerHTML = md.render(editor.value);
      postProcessDom();
      updateToc();
      updateStats();
    } finally {
      state.rendering = false;
    }
  }

  function postProcessDom() {
    // 表格横向滚动包裹
    var tables = preview.querySelectorAll('table');
    tables.forEach(function (table) {
      if (table.parentNode && table.parentNode.classList &&
          table.parentNode.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    renderMermaidBlocks();
  }

  /* ================= 目录大纲 TOC ================= */
  function updateToc() {
    var headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    tocNav.innerHTML = '';
    if (!headings.length) {
      tocNav.innerHTML = '<div class="toc-empty">暂无标题</div>';
      return;
    }
    var list = document.createElement('ul');
    list.className = 'toc-list';
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'auto-h-' + i;
      var level = parseInt(h.tagName.slice(1), 10);
      var li = document.createElement('li');
      li.className = 'toc-item toc-lv' + level;
      var a = document.createElement('a');
      a.textContent = h.textContent;
      a.href = '#' + h.id;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        smoothScrollToHeading(h.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    tocNav.appendChild(list);
  }

  function smoothScrollToHeading(id) {
    var target = preview.querySelector('#' + CSS.escape(id));
    if (!target) {
      // 回退：按标题文本匹配（兼容手写的中文锚点）
      var decoded = id;
      try { decoded = decodeURIComponent(id); } catch (e) { /* 保留原值 */ }
      var headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].textContent.trim() === decoded.trim()) {
          target = headings[i];
          break;
        }
      }
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ================= 滚动同步（按比例映射） ================= */
  var syncing = false;
  function syncScroll(source, target) {
    if (syncing) return;
    syncing = true;
    var sMax = source.scrollHeight - source.clientHeight;
    var tMax = target.scrollHeight - target.clientHeight;
    if (sMax > 0 && tMax > 0) {
      target.scrollTop = (source.scrollTop / sMax) * tMax;
    }
    setTimeout(function () { syncing = false; }, 60);
  }
  editor.addEventListener('scroll', function () {
    if (state.view !== 'edit') syncScroll(editor, preview);
  });
  preview.addEventListener('scroll', function () {
    if (state.view !== 'edit') syncScroll(preview, editor);
  });

  /* ================= 状态栏统计 ================= */
  function updateStats() {
    var text = editor.value;
    var chars = text.length;
    var latinWords = (text.match(/[A-Za-z0-9_'\-]+/g) || []).length;
    var cjkChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    var words = latinWords + cjkChars;
    var lines = text === '' ? 1 : text.split('\n').length;
    $('status-stats').textContent = '字符 ' + chars + ' · 词 ' + words + ' · 行 ' + lines;

    var pos = editor.selectionStart || 0;
    var before = text.slice(0, pos);
    var line = before.split('\n').length;
    var col = pos - before.lastIndexOf('\n');
    $('status-cursor').textContent = '行 ' + line + ', 列 ' + col;
  }

  function setModified(flag) {
    state.modified = flag;
    $('status-modified').hidden = !flag;
    callApi('set_title', state.fileName, flag);
  }

  function updatePathStatus() {
    $('status-path').textContent = state.path || '未保存的新文档';
  }

  /* ================= Python 桥 ================= */
  function apiReady() {
    return window.pywebview && window.pywebview.api;
  }

  function callApi(method) {
    if (!apiReady()) return Promise.resolve(null);
    var args = Array.prototype.slice.call(arguments, 1);
    return Promise.resolve(window.pywebview.api[method].apply(null, args));
  }

  function applyPayload(payload) {
    if (!payload || !payload.content) return;
    editor.value = payload.content;
    state.path = payload.path || null;
    state.fileName = payload.fileName || (state.path ? state.path.split(/[\\/]/).pop() : '');
    state.baseDir = payload.baseDir || '';
    updatePathStatus();
    setModified(false);
    renderPreview();
  }

  /* ================= 文件操作 ================= */
  function openFile() {
    callApi('open_file_dialog').then(function (res) {
      if (res && res.content !== undefined && !res.error) {
        applyPayload(res);
      } else if (res && res.error) {
        toast(res.error);
      }
    });
  }

  function saveFile() {
    if (state.path) {
      callApi('save_file', state.path, editor.value).then(function (res) {
        if (res && res.ok) {
          setModified(false);
          toast('已保存：' + res.path);
        } else if (res && res.error) {
          toast('保存失败：' + res.error);
        }
      });
    } else {
      saveFileAs();
    }
  }

  function saveFileAs() {
    var suggested = state.fileName || '未命名.md';
    callApi('save_file_dialog', editor.value, suggested).then(function (res) {
      if (res && res.ok) {
        state.path = res.path;
        state.fileName = res.fileName || res.path.split(/[\\/]/).pop();
        state.baseDir = res.baseDir || state.baseDir;
        updatePathStatus();
        setModified(false);
        renderPreview(); // baseDir 可能变化，重渲染图片
        toast('已另存为：' + res.path);
      } else if (res && res.error) {
        toast('保存失败：' + res.error);
      }
    });
  }

  /* ================= 导出 HTML ================= */
  function exportHtml() {
    renderPreview();
    // mermaid 为异步渲染，等待一轮后再导出
    setTimeout(function () {
      Promise.all([
        callApi('get_static', 'web/vendor/katex/katex.min.css'),
        callApi('get_static', 'web/vendor/texmath/texmath.css'),
        callApi('get_static', 'web/vendor/highlight/' + (state.theme === 'dark' ? 'github-dark.css' : 'github.css')),
        callApi('get_static', 'web/style.css')
      ]).then(function (results) {
        var css = results.filter(Boolean).join('\n');
        var title = state.fileName ? state.fileName.replace(/\.[^.]+$/, '') : 'YiQi@MD-Editor-wb-KimiK3 导出';
        var doc = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
          '<title>' + escapeHtmlText(title) + ' - YiQi@MD-Editor-wb-KimiK3</title>\n' +
          '<style>\n' + css + '\n' +
          'html,body{overflow:auto !important;height:auto !important;}\n' +
          'body{display:block !important;background:var(--bg);color:var(--fg);padding:0;}\n' +
          '.export-body{max-width:860px;margin:0 auto;padding:32px 40px;}\n' +
          '.export-brand{font-size:13px;font-weight:700;letter-spacing:1px;color:var(--accent);opacity:0.85;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px;}\n' +
          '</style>\n</head>\n<body class="' + (state.theme === 'light' ? 'theme-light' : '') + '">\n' +
          '<article class="markdown-body export-body">\n' +
          '<div class="export-brand">YiQi@MD-Editor-wb-KimiK3 v1.0.0</div>\n' +
          preview.innerHTML +
          '\n</article>\n</body>\n</html>';
        var suggested = title + '.html';
        callApi('export_html', doc, suggested).then(function (res) {
          if (res && res.ok) {
            toast('已导出：' + res.path);
          } else if (res && res.error) {
            toast('导出失败：' + res.error);
          }
        });
      });
    }, 600);
  }

  function escapeHtmlText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ================= 提示条 ================= */
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ================= 视图模式 ================= */
  var VIEWS = ['edit', 'split', 'preview'];
  var VIEW_LABELS = { edit: '视图: 编辑', split: '视图: 分屏', preview: '视图: 预览' };
  function setView(view) {
    state.view = view;
    document.body.classList.remove('view-edit', 'view-split', 'view-preview');
    document.body.classList.add('view-' + view);
    $('btn-view').textContent = VIEW_LABELS[view];
  }
  function cycleView() {
    var idx = VIEWS.indexOf(state.view);
    setView(VIEWS[(idx + 1) % VIEWS.length]);
  }

  /* ================= 主题 ================= */
  function applyTheme() {
    var light = state.theme === 'light';
    document.body.classList.toggle('theme-light', light);
    $('hl-theme-dark').disabled = light;
    $('hl-theme-light').disabled = !light;
    $('btn-theme').textContent = light ? '☾ 深色' : '☀ 浅色';
    initMermaid();
    renderPreview();
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('molan-theme', state.theme);
    applyTheme();
  }

  /* ================= 字体缩放 ================= */
  function applyFontSize() {
    document.documentElement.style.setProperty('--editor-font-size', state.fontSize + 'px');
    document.documentElement.style.setProperty('--preview-font-size', state.fontSize + 'px');
    $('font-size-label').textContent = state.fontSize + 'px';
  }
  function changeFontSize(delta) {
    state.fontSize = clampFont(state.fontSize + delta);
    localStorage.setItem('molan-font-size', String(state.fontSize));
    applyFontSize();
  }

  /* ================= 搜索 ================= */
  var searchMatches = [];
  var searchIndex = -1;

  function openSearch() {
    searchBar.hidden = false;
    searchInput.focus();
    searchInput.select();
    doSearch();
  }
  function closeSearch() {
    searchBar.hidden = true;
    editor.focus();
  }
  function doSearch() {
    var q = searchInput.value;
    searchMatches = [];
    searchIndex = -1;
    if (q) {
      var text = editor.value.toLowerCase();
      var needle = q.toLowerCase();
      var i = text.indexOf(needle);
      while (i !== -1) {
        searchMatches.push(i);
        i = text.indexOf(needle, i + needle.length);
      }
    }
    updateSearchCount();
    if (searchMatches.length) jumpToMatch(0);
  }
  function updateSearchCount() {
    var total = searchMatches.length;
    var cur = total ? searchIndex + 1 : 0;
    searchCount.textContent = cur + '/' + total;
  }
  function jumpToMatch(idx) {
    if (!searchMatches.length) return;
    searchIndex = ((idx % searchMatches.length) + searchMatches.length) % searchMatches.length;
    var start = searchMatches[searchIndex];
    var end = start + searchInput.value.length;
    editor.focus();
    editor.setSelectionRange(start, end);
    // 滚动到选区
    var lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
    var linesBefore = editor.value.slice(0, start).split('\n').length;
    editor.scrollTop = Math.max(0, (linesBefore - 4) * lineHeight);
    updateSearchCount();
  }

  /* ================= 编辑器行为 ================= */
  editor.addEventListener('input', function () {
    setModified(true);
    updateStats();
    scheduleRender();
  });
  editor.addEventListener('click', updateStats);
  editor.addEventListener('keyup', updateStats);

  // Tab 插入两个空格
  editor.addEventListener('keydown', function (ev) {
    if (ev.key === 'Tab') {
      ev.preventDefault();
      var start = editor.selectionStart;
      var end = editor.selectionEnd;
      editor.setRangeText('  ', start, end, 'end');
      setModified(true);
      updateStats();
      scheduleRender();
    }
  });

  // 代码块复制按钮（事件委托）
  preview.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.code-copy');
    if (btn) {
      var codeEl = btn.closest('.code-block').querySelector('code');
      var text = codeEl ? codeEl.textContent : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '已复制';
          setTimeout(function () { btn.textContent = '复制'; }, 1500);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1500);
      }
      return;
    }
    // 内部锚点平滑滚动
    var link = ev.target.closest('a[href^="#"]');
    if (link) {
      ev.preventDefault();
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      smoothScrollToHeading(id);
    }
  });

  /* ================= 拖拽打开 ================= */
  document.addEventListener('dragover', function (ev) { ev.preventDefault(); });
  document.addEventListener('drop', function (ev) {
    ev.preventDefault();
    var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      editor.value = String(reader.result || '');
      // 浏览器环境拿不到真实路径时，借助 pywebview read_path 尝试
      if (file.path) {
        callApi('read_path', file.path).then(function (res) {
          if (res && res.content !== undefined && !res.error) {
            applyPayload(res);
            return;
          }
          fallbackDrop(file);
        });
      } else {
        fallbackDrop(file);
      }
    };
    reader.readAsText(file);
  });
  function fallbackDrop(file) {
    state.path = null;
    state.fileName = file.name || '';
    state.baseDir = '';
    updatePathStatus();
    setModified(true);
    renderPreview();
    toast('已载入（拖拽文件未关联路径，请用另存为保存）');
  }

  /* ================= 快捷键 ================= */
  document.addEventListener('keydown', function (ev) {
    var ctrl = ev.ctrlKey || ev.metaKey;
    if (!ctrl) {
      if (ev.key === 'Escape' && !searchBar.hidden) closeSearch();
      return;
    }
    var key = ev.key.toLowerCase();
    if (key === 's') { ev.preventDefault(); saveFile(); }
    else if (key === 'o') { ev.preventDefault(); openFile(); }
    else if (key === 'f') { ev.preventDefault(); openSearch(); }
    else if (key === 'e') { ev.preventDefault(); cycleView(); }
  });

  /* ================= 按钮绑定 ================= */
  $('btn-open').addEventListener('click', openFile);
  $('btn-save').addEventListener('click', saveFile);
  $('btn-save-as').addEventListener('click', saveFileAs);
  $('btn-export').addEventListener('click', exportHtml);
  $('btn-view').addEventListener('click', cycleView);
  $('btn-search').addEventListener('click', function () {
    if (searchBar.hidden) openSearch(); else closeSearch();
  });
  $('btn-theme').addEventListener('click', toggleTheme);
  $('btn-font-inc').addEventListener('click', function () { changeFontSize(1); });
  $('btn-font-dec').addEventListener('click', function () { changeFontSize(-1); });
  $('btn-toc-toggle').addEventListener('click', function () {
    var collapsed = tocPanel.classList.toggle('collapsed');
    $('btn-toc-toggle').textContent = collapsed ? '⟩' : '⟨';
  });

  searchInput.addEventListener('input', doSearch);
  searchInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      jumpToMatch(searchIndex + (ev.shiftKey ? -1 : 1));
    } else if (ev.key === 'Escape') {
      closeSearch();
    }
  });
  $('btn-search-next').addEventListener('click', function () { jumpToMatch(searchIndex + 1); });
  $('btn-search-prev').addEventListener('click', function () { jumpToMatch(searchIndex - 1); });
  $('btn-search-close').addEventListener('click', closeSearch);

  /* ================= 启动 ================= */
  function boot() {
    applyFontSize();
    initMermaid();
    applyTheme();
    setView('split');
    updateStats();
    renderPreview();

    if (apiReady()) {
      callApi('get_initial').then(function (payload) {
        if (payload && payload.content !== undefined) {
          applyPayload(payload);
        }
      });
    }
  }

  if (window.pywebview) {
    window.addEventListener('pywebviewready', boot);
  } else {
    // 浏览器直接打开时的降级
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
