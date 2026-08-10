/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 渲染层构建脚本
 *
 * 1) 生成 src/renderer/vendor/katex-css.js：将 KaTeX 字体内嵌为 data URI，
 *    使预览 iframe 与导出的 HTML 不依赖外部字体文件。
 * 2) 使用 esbuild 将 src/renderer/app.js 及全部依赖（CodeMirror 6、
 *    markdown-it 全家桶、KaTeX、highlight.js、mermaid）打包为
 *    src/renderer/vendor/bundle.js（IIFE，供 index.html 直接引用）。
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const rendererDir = path.join(root, 'src', 'renderer');
const vendorDir = path.join(rendererDir, 'vendor');
const katexDist = path.join(root, 'node_modules', 'katex', 'dist');

fs.mkdirSync(vendorDir, { recursive: true });

/**
 * 将 KaTeX 的 CSS 与字体打包为一个导出字符串的 JS 模块。
 * 字体以 base64 data URI 内嵌，保证离线/打包后数学公式仍可正常显示。
 */
function buildKatexCssModule() {
  const cssPath = path.join(katexDist, 'katex.min.css');
  if (!fs.existsSync(cssPath)) {
    console.error('未找到 KaTeX CSS，请先执行 npm install');
    process.exit(1);
  }
  let css = fs.readFileSync(cssPath, 'utf8');

  css = css.replace(/url\(fonts\/([^)]+)\)/g, (match, fontName) => {
    const fontPath = path.join(katexDist, 'fonts', fontName);
    if (!fs.existsSync(fontPath)) {
      console.warn('未找到字体文件: ' + fontName);
      return match;
    }
    const buf = fs.readFileSync(fontPath);
    const ext = path.extname(fontName).toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === '.woff2') mime = 'font/woff2';
    else if (ext === '.woff') mime = 'font/woff';
    else if (ext === '.ttf') mime = 'font/ttf';
    return 'url(data:' + mime + ';base64,' + buf.toString('base64') + ')';
  });

  const outPath = path.join(vendorDir, 'katex-css.js');
  fs.writeFileSync(outPath, 'export default ' + JSON.stringify(css) + ';\n');
  console.log('已生成 KaTeX CSS 模块: ' + outPath);
}

/**
 * 使用 esbuild 打包渲染层源码为单一 IIFE bundle。
 */
async function bundleRenderer() {
  const entry = path.join(rendererDir, 'app.js');
  const outfile = path.join(vendorDir, 'bundle.js');

  await build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: false,
    loader: {
      '.css': 'text'
    },
    logLevel: 'info'
  });
  console.log('渲染层打包完成: ' + outfile);
}

async function main() {
  buildKatexCssModule();
  await bundleRenderer();
}

main().catch((err) => {
  console.error('构建失败:', err);
  process.exit(1);
});
