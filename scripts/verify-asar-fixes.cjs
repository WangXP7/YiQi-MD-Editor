'use strict';
/* 校验打包后 app.asar 内是否包含本轮修复、改名与多标签 */
const asar = require('@electron/asar');

const ASAR_PATH = 'build/win-unpacked/resources/app.asar';
const list = asar.listPackage(ASAR_PATH);

function read(rel) {
  const p = list.find((x) => x.replace(/^[\\/]+/, '').replace(/\\/g, '/') === rel);
  if (!p) return null;
  return asar.extractFile(ASAR_PATH, p.replace(/^[\\/]+/, '')).toString('utf8');
}

const main = read('src/main.js') || '';
const preload = read('src/preload.js') || '';
const index = read('src/renderer/index.html') || '';
const app = read('src/renderer/app.js') || '';

function show(name, pass, detail) {
  console.log((pass ? '[PASS] ' : '[FAIL] ') + name + (detail ? ' — ' + detail : ''));
}

const appNameMatch = /APP_NAME = '([^']+)'/.exec(main);
show('main.js APP_NAME', appNameMatch && appNameMatch[1] === '墨览 YiQi@MD-Editor-wb-DSv4-Flash', appNameMatch ? appNameMatch[1] : 'NOT FOUND');
show('main.js sandbox:false', /sandbox:\s*false/.test(main));
show('main.js console-message 转发', main.includes('console-message'));
show('preload.js try/catch 诊断', preload.includes('mdAPI 暴露失败'));
const titleMatch = /<title>([^<]+)<\/title>/.exec(index);
show('index.html title', titleMatch && titleMatch[1] === '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', titleMatch ? titleMatch[1] : 'NOT FOUND');
const logoMatch = /app-logo"[^>]*>([^<]+)</.exec(index);
show('index.html app-logo', logoMatch && logoMatch[1] === '墨览 YiQi', logoMatch ? logoMatch[1] : 'NOT FOUND');
show('index.html #tabbar', index.includes('id="tabbar"'));
show('index.html #outline-sidebar', index.includes('id="outline-sidebar"'));
show('app.js 标题改名', app.includes('墨览 YiQi@MD-Editor-wb-DSv4-Flash'));
show('app.js mdAPI 防御检查', app.includes('window.mdAPI 不存在'));
const tabbar = read('src/renderer/tabbar.js') || '';
show('asar 含 tabbar.js 且导出 TabManager', tabbar.includes('export class TabManager'));
const outline = read('src/renderer/outline.js') || '';
show('asar 含 outline.js 且导出 OutlineManager', outline.includes('export class OutlineManager'));
const copybtn = read('src/renderer/copybutton.js') || '';
show('asar 含 copybutton.js 且导出 CopyButtonManager', copybtn.includes('export class CopyButtonManager'));
show('bundle 不含旧名', !/墨笔/.test(read('src/renderer/vendor/bundle.js') || ''));
// esbuild 将非 ASCII 字符串转义为 \uXXXX，因此同时接受字面量与转义形式
const bundleText = read('src/renderer/vendor/bundle.js') || '';
const bundleHasNewName = bundleText.includes('墨览 YiQi@MD-Editor-wb-DSv4-Flash') || bundleText.includes('\\u58A8\\u89C8 YiQi@MD-Editor-wb-DSv4-Flash');
show('bundle 含新名', bundleHasNewName);
