// qa-asar-extract-check.cjs — 手动解析 asar 头部（pickle 格式），校验打包内容与源码一致性
const fs = require('fs');

const ASAR = 'build/win-unpacked/resources/app.asar';
const buf = fs.readFileSync(ASAR);

// asar 布局（@electron/asar v3 pickle）：
//   [0..4) pickle_size=4 | [4..8) headerSize（header pickle 总长）| [8..12) str_len+4 | [12..16) jsonLen | [16..16+jsonLen) JSON | 数据区(8+headerSize)
const headerSize = buf.readUInt32LE(4);
const jsonLen = buf.readUInt32LE(12);
const headerJson = buf.slice(16, 16 + jsonLen).toString('utf8');
const header = JSON.parse(headerJson);
const dataStart = 8 + headerSize;

function findFile(node, parts) {
  let cur = node;
  for (const p of parts) {
    if (!cur.files || !cur.files[p]) return null;
    cur = cur.files[p];
  }
  return cur;
}

function readFileBytes(node) {
  const off = dataStart + parseInt(node.offset, 10);
  return buf.slice(off, off + node.size);
}

function exists(relPath) {
  return !!findFile(header, relPath.split('/'));
}

const checks = [
  'src/main.js',
  'src/preload.js',
  'src/renderer/index.html',
  'src/renderer/app.js',
  'src/renderer/editor.js',
  'src/renderer/fileops.js',
  'src/renderer/find.js',
  'src/renderer/preview.js',
  'src/renderer/tabbar.js',
  'src/renderer/styles.css',
  'src/renderer/utils.js',
  'src/renderer/vendor/bundle.js',
  'src/renderer/vendor/bundle.js.map',
  'src/renderer/vendor/katex-css.js',
  'node_modules/iconv-lite/lib/index.js',
  'node_modules/safer-buffer/safer.js'
];

for (const c of checks) {
  console.log((exists(c) ? '[OK]  ' : '[MISS]') + ' ' + c);
}

const bNode = findFile(header, 'src/renderer/vendor/bundle.js'.split('/'));
const bSrc = fs.readFileSync('src/renderer/vendor/bundle.js');
const bAsar = readFileBytes(bNode);
console.log('bundle.js  asar bytes:', bAsar.length, '| source bytes:', bSrc.length, '| identical:', bAsar.equals(bSrc));

const kNode = findFile(header, 'src/renderer/vendor/katex-css.js'.split('/'));
const kSrc = fs.readFileSync('src/renderer/vendor/katex-css.js');
const kAsar = readFileBytes(kNode);
console.log('katex-css  asar bytes:', kAsar.length, '| source bytes:', kSrc.length, '| identical:', kAsar.equals(kSrc));

const mNode = findFile(header, 'src/main.js'.split('/'));
const mAsar = readFileBytes(mNode).toString('utf8');
console.log('asar main.js contains detectAndDecode:', mAsar.includes('function detectAndDecode'));
console.log('asar main.js contains registerIpc:', mAsar.includes('function registerIpc'));
