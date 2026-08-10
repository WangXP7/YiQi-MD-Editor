/* ============================================================
   YiQi@MD-Editor-千问-GLM5.2  —  渲染进程逻辑
   ============================================================ */
'use strict';

// ===== markdown-it 配置（全协议） =====
const md = window.markdownit({
  html: true,              // 允许 HTML 标签
  breaks: true,            // 换行转 <br>
  linkify: true,           // 自动识别链接
  typographer: true,       // 排版优化（引号等）
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const h = hljs.highlight(str, { language: lang, ignoreIllegal: true }).value;
        return '<pre class="hljs"><code class="hljs language-' + lang + '">' + h + '</code></pre>';
      } catch (e) { /* fallback */ }
    }
    return '<pre class="hljs"><code class="hljs">' + escapeHtml(str) + '</code></pre>';
  }
});

// 注册插件
md.use(window.markdownitEmoji);
md.use(window.markdownitTaskLists, { enabled: true, label: true });
md.use(window.markdownitFootnote);
md.use(window.markdownitSub);
md.use(window.markdownitSup);
md.use(window.markdownitDeflist);
md.use(window.markdownitAbbr);
md.use(window.markdownitMark);
md.use(window.markdownitIns);
// container（::: tip / warning / danger / info）
md.use(window.markdownitContainer, 'tip', containerRenderer('tip', '💡 提示'));
md.use(window.markdownitContainer, 'warning', containerRenderer('warning', '⚠️ 注意'));
md.use(window.markdownitContainer, 'danger', containerRenderer('danger', '🔥 警告'));
md.use(window.markdownitContainer, 'info', containerRenderer('info', 'ℹ️ 信息'));
md.use(window.markdownitContainer, 'details', {
  validate: function (p) { return p.trim() === 'details'; },
  render: function (tokens, idx) {
    if (tokens[idx].nesting === 1) {
      return '<details class="md-details"><summary>点击展开</summary>\n';
    } else {
      return '</details>\n';
    }
  }
});

function containerRenderer(name, title) {
  return {
    validate: function (p) { return p.trim() === name; },
    render: function (tokens, idx) {
      if (tokens[idx].nesting === 1) {
        return '<div class="md-container md-' + name + '"><div class="md-container-title">' + title + '</div>\n';
      }
      return '</div>\n';
    }
  };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== KaTeX 数学公式预处理 =====
function renderMath(html) {
  const opts = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false
  };
  try {
    renderMathInElementFromString(html, opts);
  } catch (e) { /* ignore */ }
}

// 在字符串上做 KaTeX 替换（因 preview 已是 innerHTML）
function applyKatexFromString(container) {
  if (!window.renderMathInElement) return;
  try {
    window.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  } catch (e) { /* ignore */ }
}

// ===== Mermaid 初始化 =====
let mermaidIdx = 0;
function renderMermaidAsync(container) {
  const blocks = container.querySelectorAll('.language-mermaid, .mermaid');
  if (blocks.length && window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
    blocks.forEach((b, i) => {
      const id = 'mmd-' + Date.now() + '-' + i;
      const code = b.tagName === 'PRE' ? b.textContent : b.innerHTML;
      if (!code.trim()) return;
      window.mermaid.render(id, code).then(({ svg }) => {
        const wrap = document.createElement('div');
        wrap.className = 'mermaid';
        wrap.innerHTML = svg;
        b.replaceWith(wrap);
      }).catch(() => {});
    });
  }
}

// ===== CodeMirror 初始化 =====
const editorEl = document.getElementById('editor');
const editor = CodeMirror.fromTextArea(editorEl, {
  mode: 'gfm',
  theme: 'dracula',
  lineNumbers: true,
  lineWrapping: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  autoCloseBrackets: true,
  matchBrackets: true,
  styleActiveLine: true,
  continueList: true,
  extraKeys: {
    'Enter': 'newlineAndIndentContinueMarkdownList',
    'Cmd-Ctrl-Space': 'autocomplete',
    'F11': (cm) => cm.setOption('fullScreen', !cm.getOption('fullScreen')),
    'Esc': (cm) => { if (cm.getOption('fullScreen')) cm.setOption('fullScreen', false); }
  }
});
window.editor = editor;

// ===== 预览渲染 =====
const preview = document.getElementById('preview');
const previewScroll = document.getElementById('preview-scroll');
let renderTimer = null;

function updatePreview() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const src = editor.getValue();
    const html = md.render(src);
    preview.innerHTML = html;
    applyKatexFromString(preview);
    renderMermaidAsync(preview);
    // 链接外部打开
    preview.querySelectorAll('a[href^="http"]').forEach(a => {
      a.target = '_blank';
    });
    // 任务列表点击
    preview.querySelectorAll('input[type=checkbox]').forEach((cb, i) => {
      cb.addEventListener('change', () => toggleTaskCheckbox(cb, i));
    });
    updateOutline();
    updateStatus();
    window.yiQi && window.yiQi.notifyChanged();
  }, 150);
}

function toggleTaskCheckbox(cb, idx) {
  // 在编辑器中同步勾选状态
  const doc = editor.getValue();
  let count = 0;
  const lines = doc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*[-*+]\s\[)([ xX])(\]\s.*)$/);
    if (m) {
      if (count === idx) {
        lines[i] = m[1] + (cb.checked ? 'x' : ' ') + m[3];
        break;
      }
      count++;
    }
  }
  const cur = editor.getCursor();
  editor.setValue(lines.join('\n'));
  editor.setCursor(cur);
  updatePreview();
}

// ===== 大纲 =====
const outlineBody = document.getElementById('outline-body');
function updateOutline() {
  const heads = preview.querySelectorAll('h1,h2,h3,h4,h5,h6');
  outlineBody.innerHTML = '';
  heads.forEach((h, i) => {
    if (!h.id) h.id = 'hd-' + i;
    const div = document.createElement('div');
    div.className = 'outline-item ' + h.tagName.toLowerCase();
    div.textContent = h.textContent || ('#' + i);
    div.title = h.textContent;
    div.onclick = () => {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    outlineBody.appendChild(div);
  });
}

// ===== 状态栏 =====
const stPos = document.getElementById('st-pos');
const stCount = document.getElementById('st-count');
const stFile = document.getElementById('st-file');
function updateStatus() {
  const cur = editor.getCursor();
  stPos.textContent = `行 ${cur.line + 1}, 列 ${cur.ch + 1}`;
  stCount.textContent = `${editor.getValue().length} 字`;
}
editor.on('cursorActivity', updateStatus);

// ===== 视图切换 =====
const themes = ['theme-dark', 'theme-light', 'theme-green'];
let themeIdx = 0;
const editorThemes = ['dracula', 'material-darker', 'ayu-dark'];

function setView(view) {
  document.body.classList.remove('edit-view', 'split-view', 'preview-view');
  document.body.classList.add(view + '-view');
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  const map = { edit: 'btn-view-edit', split: 'btn-view-split', preview: 'btn-view-preview' };
  const btn = document.getElementById(map[view]);
  if (btn) btn.classList.add('active');
  setTimeout(() => editor.refresh(), 50);
}

function toggleTheme() {
  themeIdx = (themeIdx + 1) % themes.length;
  document.body.className = themes[themeIdx] + ' ' + (document.body.classList.contains('preview-view') ? 'preview-view' : document.body.classList.contains('edit-view') ? 'edit-view' : 'split-view');
  editor.setOption('theme', editorThemes[themeIdx]);
}

function toggleOutline() {
  const p = document.getElementById('outline-pane');
  p.classList.toggle('show');
}

// ===== 工具栏按钮 =====
document.getElementById('btn-new').onclick = () => { window.yiQi && requireNothing(); };
document.getElementById('btn-open').onclick = () => triggerMenu('open');
document.getElementById('btn-save').onclick = () => window.yiQi && window.yiQi.requestSave();
document.getElementById('btn-view-edit').onclick = () => setView('edit');
document.getElementById('btn-view-split').onclick = () => setView('split');
document.getElementById('btn-view-preview').onclick = () => setView('preview');
document.getElementById('btn-theme').onclick = toggleTheme;
document.getElementById('btn-outline').onclick = toggleOutline;
document.getElementById('btn-export-html').onclick = exportHtml;
document.getElementById('btn-export-pdf').onclick = exportPdf;

function triggerMenu() {} // 主菜单已处理，这里空实现避免报错
function requireNothing() { newDoc(); }
function newDoc() {
  editor.setValue('# 新文档\n\n在此开始书写...\n');
  updatePreview();
  window.yiQi && window.yiQi.notifyChanged();
}

// ===== 导出 =====
async function exportHtml() {
  const html = preview.innerHTML;
  const full = '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>导出</title></head><body class="markdown-body" style="max-width:860px;margin:40px auto;padding:24px;font-family:sans-serif;">' + html + '</body></html>';
  // 用 preload 的保存对话框
  const path = await window.yiQi.pickSavePath('导出.html');
  if (!path) return;
  // 通过 blob 下载
  const blob = new Blob([full], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = path.split(/[\\/]/).pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function exportPdf() {
  // 切到预览模式 → 触发主进程 printToPDF
  const prevClass = document.body.className;
  document.body.classList.remove('edit-view', 'split-view', 'preview-view');
  document.body.classList.add('preview-view');
  await new Promise(r => setTimeout(r, 300));
  window.yiQi && window.yiQi.exportPdfReq();
  setTimeout(() => {
    document.body.className = prevClass;
    editor.refresh();
  }, 500);
}

// ===== 编辑器命令 =====
editor.on('change', () => updatePreview());

window.yiQi && window.yiQi.onEditorCmd(cmd => {
  switch (cmd) {
    case 'undo': editor.undo(); break;
    case 'redo': editor.redo(); break;
    case 'find':
      CodeMirror.commands.find(editor);
      break;
    case 'toggle-theme': toggleTheme(); break;
    case 'toggle-outline': toggleOutline(); break;
  }
});

window.yiQi && window.yiQi.onEditorWrap(({ before, after }) => {
  const sel = editor.getSelection();
  if (sel) {
    editor.replaceSelection(before + sel + after);
  } else {
    editor.replaceSelection(before + after);
    const cur = editor.getCursor();
    editor.setCursor({ line: cur.line, ch: cur.ch - after.length });
  }
});

window.yiQi && window.yiQi.onInsertTable(() => {
  const tpl = '\n| 列1 | 列2 | 列3 |\n|:---:|:---:|:---:|\n| 内容 | 内容 | 内容 |\n';
  editor.replaceSelection(tpl);
});

window.yiQi && window.yiQi.onInsertTask(() => {
  editor.replaceSelection('\n- [ ] 待办事项\n');
});

window.yiQi && window.yiQi.onSetView(v => setView(v));

// ===== 文件加载 =====
window.yiQi && window.yiQi.onFileLoaded(({ path, content }) => {
  editor.setValue(content || '');
  stFile.textContent = path ? path.split(/[\\/]/).pop() : '未命名.md';
  updatePreview();
});

window.yiQi && window.yiQi.onFileSaved(({ path }) => {
  stFile.textContent = path ? path.split(/[\\/]/).pop() : '未命名.md';
});

// ===== 拖放打开文件 =====
const dropMask = document.getElementById('drop-mask');
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropMask.classList.add('show');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', (e) => {
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropMask.classList.remove('show'); }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropMask.classList.remove('show');
  const files = e.dataTransfer.files;
  if (files && files.length && window.yiQi) {
    window.yiQi.dropFile(files[0].path);
  }
});

// ===== 速查表 =====
const cheatSheet = {
  '标题': '`# 一级标题`  `## 二级`  `### 三级`',
  '强调': '`**粗体**`  `*斜体*`  `~~删除线~~`  `==标记==`',
  '列表': '`- 无序列表`  `1. 有序列表`  `- [x] 已完成`  `- [ ] 未完成`',
  '链接': '`[文字](https://url.com "标题")`',
  '图片': '`![替代文字](https://url.com/img.png)`',
  '引用': '> 引用内容',
  '代码': '` \`行内代码\` ` 代码块用三个反引号包裹并指定语言',
  '表格': '`| 列1 | 列2 |\\n|---|---|\\n| a | b |`',
  '分隔线': '`---` 或 `***`',
  '脚注': '`正文[^1]`  `[^1]: 脚注内容`',
  '定义列表': '`术语\\n: 定义内容`',
  '上下标': '`H~2~O`  `x^2^`',
  '插入': '`++插入文字++`',
  '容器': '`::: tip`\\n`内容`\\n`:::`  支持 tip/warning/danger/info/details',
  '数学公式': '`$行内公式$`  `$$块级公式$$`  支持 KaTeX',
  '流程图': '用 ` ```mermaid ` 代码块，支持 Mermaid 语法',
  'Emoji': '`:smile:` `:heart:` `:rocket:`'
};

document.getElementById('btn-export-pdf') && null;
function showCheatSheet() {
  const modal = document.getElementById('cheatsheet-modal');
  const body = document.getElementById('cs-body');
  body.innerHTML = '';
  for (const [k, v] of Object.entries(cheatSheet)) {
    const h = document.createElement('h3');
    h.textContent = k;
    body.appendChild(h);
    const p = document.createElement('p');
    p.innerHTML = v;
    body.appendChild(p);
  }
  modal.style.display = 'block';
}
document.getElementById('cs-close').onclick = () => document.getElementById('cheatsheet-modal').style.display = 'none';
document.getElementById('cs-bg').onclick = () => document.getElementById('cheatsheet-modal').style.display = 'none';
window.yiQi && window.yiQi.onShowCheatsheet(showCheatSheet);

// ===== 初始示例内容 =====
editor.setValue(`# 欢迎使用 YiQi@MD-Editor-千问-GLM5.2

> **YiQi@MD-Editor-千问-GLM5.2** — 一款美观、功能齐全的 Markdown 查看/编辑器。

## ✨ 功能特性

- **全协议支持**：GFM 表格、任务列表、脚注、上下标、定义列表、缩写、插入、标记
- **数学公式**：基于 KaTeX 的 \`行内 $E=mc^2$\` 与块级公式
- **流程图/图表**：Mermaid 支持（饼图、流程图、时序图、甘特图等）
- **代码高亮**：highlight.js 全语言
- **Emoji**：:rocket: :heart: :smile:
- **容器块**：tip / warning / danger / info / details
- **多主题**：暗色 / 亮色 / 护眼绿
- **实时预览 / 分屏 / 纯编辑 / 纯预览**
- **大纲导航**、**拖放打开**、**导出 HTML & PDF**

## 📊 表格示例

| 功能 | 支持情况 | 说明 |
|:---:|:---:|:---|
| GFM 表格 | ✅ | 完整支持 |
| 任务列表 | ✅ | 可勾选联动 |
| 脚注 | ✅ | 自动编号 |
| 数学公式 | ✅ | KaTeX 渲染 |
| 流程图 | ✅ | Mermaid |

## ✅ 任务列表

- [x] 核心编辑器
- [x] 全协议渲染
- [x] 多主题切换
- [ ] 更多导出格式

## 💡 容器块

::: tip
这是一个提示容器。
:::

::: warning
这是注意容器。
:::

## 🧮 数学公式

行内公式：$a^2 + b^2 = c^2$

块级公式：

$$\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$

## 📈 Mermaid 流程图

\`\`\`mermaid
graph LR
  A[开始] --> B{条件判断}
  B -->|是| C[执行]
  B -->|否| D[结束]
  C --> D
\`\`\`

## 🦶 脚注

这是一段带脚注的文字[^1]，还有另一个[^note]。

[^1]: 这是第一个脚注。
[^note]: 自定义标签脚注。

## 🔧 其他

- 上标：x^2^，下标：H~2~O
- 插入：++新增内容++
- 标记：==重点==
- Emoji：:tada: :100:

---

开始你的创作吧！
`);
updatePreview();
