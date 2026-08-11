# -*- coding: utf-8 -*-
"""渲染自测：在 WebView2 中加载与产品相同的前端库，验证 KaTeX / Mermaid / GFM 渲染"""
import os
import sys
import time
import webview

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "src", "web")

TEST_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="vendor/markdown-it.min.js"></script>
<script src="vendor/markdown-it-task-lists.min.js"></script>
<script src="vendor/markdown-it-footnote.min.js"></script>
<script src="vendor/markdown-it-sub.min.js"></script>
<script src="vendor/markdown-it-sup.min.js"></script>
<script src="vendor/markdown-it-mark.min.js"></script>
<script src="vendor/markdown-it-ins.min.js"></script>
<script src="vendor/markdown-it-deflist.min.js"></script>
<script src="vendor/markdown-it-abbr.min.js"></script>
<script src="vendor/markdown-it-emoji.min.js"></script>
<script src="vendor/markdown-it-container.min.js"></script>
<script src="vendor/katex/katex.min.js"></script>
<script src="vendor/katex/mhchem.min.js"></script>
<script src="vendor/markdown-it-texmath.js"></script>
<script src="vendor/highlight.min.js"></script>
<script src="vendor/mermaid.min.js"></script>
</head><body><div id="r"></div>
<script>
var md = window.markdownit({html:true, linkify:true})
  .use(window.markdownitTaskLists, {enabled:true})
  .use(window.markdownitFootnote)
  .use(window.markdownitSub).use(window.markdownitSup)
  .use(window.markdownitMark).use(window.markdownitIns)
  .use(window.markdownitDeflist).use(window.markdownitAbbr)
  .use(window.markdownitEmoji);
if (window.texmath && window.katex) {
  md.use(window.texmath, {engine: window.katex, delimiters:'dollars',
     katexOptions:{throwOnError:false, strict:false}});
}
md.use(window.markdownitContainer, 'tip', {
  validate: function(p){return p.trim().split(/\\s+/)[0]==='tip';},
  render: function(tokens, idx){ return tokens[idx].nesting===1 ? '<div class="admonition tip">' : '</div>'; }
});
md.renderer.rules.fence = function(tokens, idx){
  var t = tokens[idx], lang = (t.info||'').trim();
  if (lang === 'mermaid') return '<div class="mermaid">' + t.content + '</div>';
  return '<pre><code class="hljs">' + hljs.highlightAuto(t.content).value + '</code></pre>';
};
var src = [
  '# T',
  '',
  '$$E = mc^2$$',
  '',
  'inline $e^{i\\\\pi}+1=0$ and $\\\\ce{2H2 + O2 -> 2H2O}$',
  '',
  '```mermaid',
  'flowchart TD',
  '    A[开始] --> B{判断}',
  '```',
  '',
  '- [x] done',
  '',
  '::: tip 提示',
  'hello :rocket:',
  ':::',
  '',
  'Term',
  ': def',
  '',
  'x^2^ y~3~ ==mark== ++ins++',
  '',
  'note[^1]',
  '',
  '[^1]: foot',
  '',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |'
].join('\\n');
document.getElementById('r').innerHTML = md.render(src);
mermaid.initialize({startOnLoad:false, suppressErrors:true});
mermaid.run({nodes: Array.prototype.slice.call(document.querySelectorAll('.mermaid'))})
  .then(function(){
    document.title = 'OK KATEX=' + document.querySelectorAll('.katex').length
      + ' MERMAID_SVG=' + document.querySelectorAll('.mermaid svg').length
      + ' TASK=' + document.querySelectorAll('.task-list-item').length
      + ' FOOT=' + document.querySelectorAll('.footnote-item').length
      + ' EMOJI=' + (document.getElementById('r').innerHTML.indexOf('🚀') >= 0)
      + ' ADM=' + document.querySelectorAll('.admonition').length
      + ' TABLE=' + document.querySelectorAll('table').length
      + ' DEFL=' + document.querySelectorAll('dl').length
      + ' MARK=' + document.querySelectorAll('mark').length;
  })
  .catch(function(e){ document.title = 'ERR ' + e; });
</script></body></html>"""


def main():
    with open(os.path.join(WEB, "__test__.html"), "w", encoding="utf-8") as f:
        f.write(TEST_HTML)
    window = webview.create_window("render-test", url=os.path.join(WEB, "__test__.html"))

    def check():
        time.sleep(4)
        title = window.evaluate_js("document.title")
        print("RENDER-TEST:", title)
        os.remove(os.path.join(WEB, "__test__.html"))
        window.destroy()

    import threading
    threading.Thread(target=check, daemon=True).start()
    webview.start(debug=False, gui="edgechromium")


if __name__ == "__main__":
    main()
