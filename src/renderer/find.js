/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 查找 / 替换面板
 *
 * 使用 @codemirror/search 的 SearchQuery 驱动 CodeMirror 高亮与跳转，
 * 面板 UI 为自绘 HTML，支持查找、上一个/下一个、替换、全部替换、
 * 区分大小写、正则匹配。
 */

/**
 * 查找/替换面板控制器。
 */
export class FindPanel {
  /**
   * @param {object} editor 编辑器控制句柄（createEditor 返回值）
   * @param {object} dom {panel, input, replaceInput, prev, next, replace, replaceAll,
   *                       caseCheck, regexCheck, status, close}
   */
  constructor(editor, dom) {
    this.editor = editor;
    this.dom = dom;
    this.mode = 'find'; // 'find' | 'replace'
    this.lastQuery = null;

    this._bindEvents();
  }

  /**
   * 绑定面板 DOM 事件。
   */
  _bindEvents() {
    const { input, replaceInput, prev, next, replace, replaceAll, caseCheck, regexCheck, close } = this.dom;

    const runQuery = () => this._applyQuery();

    input.addEventListener('input', runQuery);
    caseCheck.addEventListener('change', runQuery);
    regexCheck.addEventListener('change', runQuery);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        this.findPrevious();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.findNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        this.findPrevious();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.replaceNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    prev.addEventListener('click', () => this.findPrevious());
    next.addEventListener('click', () => this.findNext());
    replace.addEventListener('click', () => this.replaceNext());
    replaceAll.addEventListener('click', () => this.replaceAll());
    close.addEventListener('click', () => this.close());
  }

  /**
   * 打开面板。
   * @param {string} mode 'find' | 'replace'
   */
  open(mode) {
    this.mode = mode || 'find';
    this.dom.panel.classList.remove('hidden');
    const { replaceInput, replace } = this.dom;
    const showReplace = this.mode === 'replace';
    replaceInput.parentElement.classList.toggle('hidden', !showReplace);
    replace.classList.toggle('hidden', !showReplace);
    if (this.mode === 'replace') {
      this.dom.replaceInput.focus();
      this.dom.replaceInput.select();
    } else {
      this.dom.input.focus();
      this.dom.input.select();
    }
    // 预填当前选中文本
    const sel = this.editor.view.state.selection.main;
    const selected = sel.empty ? '' : this.editor.view.state.sliceDoc(sel.from, sel.to);
    if (selected && !this.dom.input.value) {
      this.dom.input.value = selected;
    }
    this._applyQuery();
  }

  /**
   * 关闭面板。
   */
  close() {
    this.dom.panel.classList.add('hidden');
    this.editor.view.focus();
  }

  /**
   * 构造并应用搜索查询。
   */
  _applyQuery() {
    const searchText = this.dom.input.value;
    if (!searchText) {
      this._setStatus('');
      return;
    }
    const caseSensitive = this.dom.caseCheck.checked;
    const regexp = this.dom.regexCheck.checked;
    let query;
    try {
      query = this.editor.makeQuery(searchText, caseSensitive, regexp);
    } catch (err) {
      this._setStatus('正则表达式无效');
      return;
    }
    this.lastQuery = query;
    this.editor.setQuery(query);
    const count = this._countMatches(query);
    this._setStatus(count > 0 ? count + ' 个匹配' : '无匹配');
  }

  /**
   * 统计匹配数量。
   * @param {object} query SearchQuery
   * @returns {number}
   */
  _countMatches(query) {
    const doc = this.editor.view.state.doc;
    let count = 0;
    const searchStr = query.search;
    const caseSensitive = query.caseSensitive;
    const regexp = query.regexp;

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text;
      if (regexp) {
        let flags = 'g';
        if (!caseSensitive) flags += 'i';
        let re;
        try {
          re = new RegExp(searchStr, flags);
        } catch (err) {
          return 0;
        }
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          count++;
          if (m[0] === '') re.lastIndex++;
        }
      } else {
        let idx = 0;
        const needle = caseSensitive ? searchStr : searchStr.toLowerCase();
        const haystack = caseSensitive ? text : text.toLowerCase();
        while (true) {
          idx = haystack.indexOf(needle, idx);
          if (idx === -1) break;
          count++;
          idx += needle.length;
        }
      }
    }
    return count;
  }

  /**
   * 查找下一个。
   */
  findNext() {
    if (!this.lastQuery) this._applyQuery();
    this.editor.findNext();
  }

  /**
   * 查找上一个。
   */
  findPrevious() {
    if (!this.lastQuery) this._applyQuery();
    this.editor.findPrevious();
  }

  /**
   * 替换当前匹配。
   */
  replaceNext() {
    if (!this.lastQuery) this._applyQuery();
    const replaceText = this.dom.replaceInput.value;
    if (!this.dom.replaceInput.parentElement.classList.contains('hidden')) {
      this.editor.replaceNext();
      // 替换后重新统计
      this._applyQuery();
    }
  }

  /**
   * 全部替换。
   */
  replaceAll() {
    if (!this.lastQuery) this._applyQuery();
    const replaceText = this.dom.replaceInput.value;
    if (!this.dom.replaceInput.parentElement.classList.contains('hidden')) {
      this.editor.replaceAll();
      this._applyQuery();
    }
  }

  /**
   * 更新状态文本。
   * @param {string} text
   */
  _setStatus(text) {
    this.dom.status.textContent = text;
  }
}
