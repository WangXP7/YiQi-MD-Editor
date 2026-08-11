/**
 * verify-icon.cjs — 验证打包产物 exe 的自定义图标是否生效。
 *
 * 原理：
 *  - 默认 Electron 官方 exe 的图标资源是旧式 ICO（BMP 位图条目），不含 PNG 内嵌数据；
 *  - 本项目的 resources/icon.ico 为自绘多尺寸图标（Vista+ 格式，内含 PNG 压缩条目），
 *    被 rcedit 写入 exe 后，exe 二进制中应出现 PNG magic（0x89 0x50 0x4E 0x47）。
 *  - 因此通过统计 exe 中 PNG magic 出现次数可区分"默认图标"与"自定义图标已生效"。
 *
 * 同时尝试解析 exe 的 RT_GROUP_ICON / RT_ICON 资源个数（粗略），并输出 ICO 头部信息。
 */
const fs = require('fs');
const path = require('path');

const root = 'D:/68.AIGC/xWorkBuddy/2026-08-05-21-33-55/md-editor';

/** 统计 buf 中 PNG magic（89 50 4E 47）出现次数 */
function countPngMagic(buf) {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let count = 0;
  let idx = buf.indexOf(magic);
  while (idx !== -1) {
    count++;
    idx = buf.indexOf(magic, idx + 1);
  }
  return count;
}

/** 解析 ICO 头部：返回尺寸列表 */
function parseIcoEntries(buf) {
  if (buf.length < 6) return null;
  const reserved = buf.readUInt16LE(0);
  const type = buf.readUInt16LE(2);
  const count = buf.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) return null;
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    if (off + 16 > buf.length) break;
    const w = buf[off] === 0 ? 256 : buf[off];
    const h = buf[off + 1] === 0 ? 256 : buf[off + 1];
    const bpp = buf.readUInt16LE(off + 6);
    sizes.push(`${w}x${h}@${bpp}bpp`);
  }
  return { count, sizes };
}

function analyzeFile(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[${label}] 文件不存在: ${filePath}`);
    return;
  }
  const stat = fs.statSync(filePath);
  const buf = fs.readFileSync(filePath);
  const pngCount = countPngMagic(buf);
  console.log(`[${label}]`);
  console.log(`  path: ${filePath}`);
  console.log(`  size: ${stat.size} bytes`);
  console.log(`  PNG magic count: ${pngCount}`);
  if (filePath.toLowerCase().endsWith('.ico')) {
    const ico = parseIcoEntries(buf);
    console.log(`  ICO entries: ${ico ? ico.count + ' -> ' + ico.sizes.join(', ') : 'N/A (not classic ICO header)'}`);
  }
  return { label, size: stat.size, pngCount };
}

console.log('=== 图标验证（PNG magic 字节搜索）===\n');

// 1) 基线：官方默认 electron.exe（未替换图标）
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const baseline = analyzeFile('基线 electron.exe (默认图标)', electronExe);

// 2) 自定义图标资源本身
const iconIco = path.join(root, 'resources', 'icon.ico');
const icoInfo = analyzeFile('resources/icon.ico (自定义图标源)', iconIco);

// 3) 打包产物：win-unpacked exe
const unpackedExe = path.join(root, 'build', 'win-unpacked', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0.exe');
const unpacked = analyzeFile('win-unpacked exe (新产物)', unpackedExe);

// 4) 打包产物：portable exe
const portableExe = path.join(root, 'build', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-portable-x64.exe');
const portable = analyzeFile('portable exe (新产物)', portableExe);

// 5) 打包产物：nsis installer exe
const nsisExe = path.join(root, 'build', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-x64.exe');
const nsis = analyzeFile('nsis installer exe (新产物)', nsisExe);

console.log('\n=== 结论 ===');
const verdicts = [];
if (baseline && unpacked) {
  const replaced = unpacked.pngCount > baseline.pngCount;
  verdicts.push(`win-unpacked 相比默认 electron.exe PNG magic: ${unpacked.pngCount} > ${baseline.pngCount} -> ${replaced ? '图标已替换 ✓' : '未替换 ✗'}`);
}
if (unpacked && icoInfo) {
  const containsIcoPng = unpacked.pngCount >= (icoInfo.pngCount || 1) ? true : unpacked.pngCount > 0;
  verdicts.push(`win-unpacked 内含自定义图标 PNG 数据: ${unpacked.pngCount} 处 (icon.ico 含 ${icoInfo.pngCount} 处) -> ${unpacked.pngCount > 0 ? '已生效 ✓' : '未生效 ✗'}`);
}
if (portable) verdicts.push(`portable exe PNG magic: ${portable.pngCount} 处`);
if (nsis) verdicts.push(`nsis installer PNG magic: ${nsis.pngCount} 处`);
verdicts.forEach((v) => console.log('  - ' + v));
