/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 编辑器模块（CodeMirror 6）
 *
 * 负责创建与配置 CodeMirror 6 实例：Markdown 语法高亮、行号、
 * 括号自动匹配、自动补全、代码折叠、查找/替换状态、滚动事件等。
 */

import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor
} from '@codemirror/view';
import {
  history,
  undo,
  redo,
  defaultKeymap,
  indentWithTab
} from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldKeymap,
  indentUnit
} from '@codemirror/language';
import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completionKeymap
} from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  highlightSelectionMatches,
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll
} from '@codemirror/search';
import { tags as t } from '@lezer/highlight';

/**
 * Markdown 语法高亮样式：将 token 映射到自定义 CSS 类，
 * 由 styles.css 中的主题变量控制颜色（亮/暗随主题切换）。
 */
const markdownHighlightStyle = HighlightStyle.define([
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], class: 'tok-heading' },
  { tag: t.quote, class: 'tok-quote' },
  { tag: t.link, class: 'tok-link' },
  { tag: t.url, class: 'tok-url' },
  { tag: [t.emphasis, t.strong], class: 'tok-emphasis' },
  { tag: t.strikethrough, class: 'tok-strikethrough' },
  { tag: t.monospace, class: 'tok-code' },
  { tag: [t.keyword, t.operatorKeyword], class: 'tok-keyword' },
  { tag: [t.string, t.special(t.string)], class: 'tok-string' },
  { tag: [t.comment, t.blockComment, t.lineComment], class: 'tok-comment' },
  { tag: [t.meta, t.processingInstruction], class: 'tok-meta' },
  { tag: [t.escape, t.invalid], class: 'tok-escape' }
]);

/**
 * 编辑器主题：全部使用 CSS 变量，切换主题时无需重建编辑器。
 */
const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--cm-bg)',
      color: 'var(--cm-text)'
    },
    '.cm-content': {
      caretColor: 'var(--cm-cursor)'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--cm-gutter)',
      color: 'var(--cm-gutter-text)',
      borderRight: '1px solid var(--border)'
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--cm-active-line)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--cm-active-line)',
      color: 'var(--accent)'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--cm-selection) !important'
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--cm-cursor)'
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--accent-soft)',
      outline: '1px solid var(--accent)',
      borderRadius: '2px'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--accent)',
      color: '#ffffff'
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      color: 'var(--text-secondary)'
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-find)',
      border: '1px solid var(--border-strong)',
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-lg)'
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--accent-soft)',
      color: 'var(--text-primary)'
    }
  },
  { dark: false }
);

/**
 * 创建 CodeMirror 6 编辑器实例。
 *
 * @param {object} options
 * @param {HTMLElement} options.container 挂载容器
 * @param {string} [options.initialDoc] 初始文档内容
 * @param {(text: string) => void} [options.onDocChange] 文档变化回调
 * @param {(state: EditorState) => void} [options.onCursorChange] 光标变化回调
 * @param {() => void} [options.onScroll] 滚动回调（用于预览联动）
 * @param {() => void} [options.onRequestFind] 请求打开查找面板
 * @param {() => void} [options.onRequestReplace] 请求打开替换面板
 * @returns {object} 编辑器控制句柄
 */
export function createEditor(options) {
  const {
    container,
    initialDoc = '',
    onDocChange = () => {},
    onCursorChange = () => {},
    onScroll = () => {},
    onRequestFind = () => {},
    onRequestReplace = () => {}
  } = options;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onDocChange(update.state.doc.toString(), update);
    }
    if (update.selectionSet || update.docChanged) {
      onCursorChange(update.state);
    }
  });

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      foldGutter(),
      history(),
      highlightSelectionMatches(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(markdownHighlightStyle),
      EditorState.tabSize.of(4),
      indentUnit.of('    '),
      keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: 'Mod-f',
          run: () => {
            onRequestFind();
            return true;
          }
        },
        {
          key: 'Mod-h',
          run: () => {
            onRequestReplace();
            return true;
          }
        },
        ...defaultKeymap
      ]),
      updateListener,
      editorTheme
    ]
  });

  const view = new EditorView({ state, parent: container });

  // 滚动事件 → 预览联动
  view.scrollDOM.addEventListener('scroll', () => {
    onScroll(view);
  });

  return {
    /** CodeMirror 视图实例 */
    view,

    /** 获取当前文档文本 */
    getDoc: () => view.state.doc.toString(),

    /** 整体替换文档内容（不产生历史记录） */
    setDoc: (text) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: String(text || '') }
      });
    },

    /** 撤销 */
    undo: () => undo(view),

    /** 重做 */
    redo: () => redo(view),

    /** 聚焦编辑器 */
    focus: () => view.focus(),

    /** 设置搜索查询（供查找面板使用） */
    setQuery: (query) => {
      view.dispatch({ effects: setSearchQuery.of(query) });
    },

    /** 构造 SearchQuery */
    makeQuery: (searchText, caseSensitive, regexp) =>
      new SearchQuery({ search: searchText, caseSensitive, regexp }),

    /** 查找下一个/上一个/替换/全部替换 */
    findNext: () => findNext(view),
    findPrevious: () => findPrevious(view),
    replaceNext: () => replaceNext(view),
    replaceAll: () => replaceAll(view),

    /** 销毁编辑器 */
    destroy: () => view.destroy()
  };
}
