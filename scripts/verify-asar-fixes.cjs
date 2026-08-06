'use strict';
/* 校验打包后 app.asar 内是否包含本轮修复与改名 */
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
show('main.js APP_NAME', appNameMatch && appNameMatch[1] === 'YiQi@MD-Editor-V4-Flash', appNameMatch ? appNameMatch[1] : 'NOT FOUND');
show('main.js sandbox:false', /sandbox:\s*false/.test(main));
show('main.js console-message 转发', main.includes('console-message'));
show('preload.js try/catch 诊断', preload.includes('mdAPI 暴露失败'));
const titleMatch = /<title>([^<]+)<\/title>/.exec(index);
show('index.html title', titleMatch && titleMatch[1] === 'YiQi@MD-Editor-V4-Flash', titleMatch ? titleMatch[1] : 'NOT FOUND');
const logoMatch = /app-logo"[^>]*>([^<]+)</.exec(index);
show('index.html app-logo', logoMatch && logoMatch[1] === 'YiQi@MD-Editor-V4-Flash', logoMatch ? logoMatch[1] : 'NOT FOUND');
show('app.js 标题改名', app.includes('YiQi@MD-Editor-V4-Flash'));
show('app.js mdAPI 防御检查', app.includes('window.mdAPI 不存在'));
show('bundle 不含旧名', !/墨笔/.test(read('src/renderer/vendor/bundle.js') || ''));
show('bundle 含新名', (read('src/renderer/vendor/bundle.js') || '').includes('YiQi@MD-Editor-V4-Flash'));
