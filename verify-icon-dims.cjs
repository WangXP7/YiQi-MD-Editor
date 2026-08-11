/**
 * verify-icon-dims.cjs — 从 exe 中提取 PNG 数据块并解析 IHDR 尺寸，
 * 与自定义 icon.ico 的条目尺寸对比，证明自定义图标已写入 exe 资源。
 */
const fs = require('fs');
const path = require('path');

const root = 'D:/68.AIGC/xWorkBuddy/2026-08-05-21-33-55/md-editor';

/** 找到 buf 中所有 PNG 块（magic ... IEND），返回 {offset, w, h, len} 列表 */
function extractPngs(buf) {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const results = [];
  let idx = buf.indexOf(magic);
  while (idx !== -1) {
    // IHDR: magic(8) + length(4) + 'IHDR'(4) + w(4) + h(4)
    if (idx + 24 <= buf.length) {
      const len = buf.readUInt32BE(idx + 8);
      if (len >= 13 && buf.toString('latin1', idx + 12, idx + 16) === 'IHDR') {
        const w = buf.readUInt32BE(idx + 16);
        const h = buf.readUInt32BE(idx + 20);
        results.push({ offset: idx, w, h, len });
      }
    }
    idx = buf.indexOf(magic, idx + 1);
  }
  return results;
}

/** 解析 ICO 尺寸列表 */
function parseIcoSizes(buf) {
  const count = buf.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const w = buf[off] === 0 ? 256 : buf[off];
    const h = buf[off + 1] === 0 ? 256 : buf[off + 1];
    sizes.push(`${w}x${h}`);
  }
  return sizes;
}

function analyze(label, filePath) {
  if (!fs.existsSync(filePath)) return;
  const buf = fs.readFileSync(filePath);
  const pngs = extractPngs(buf);
  const dims = [...new Set(pngs.map((p) => `${p.w}x${p.h}`))].sort((a, b) => {
    const na = parseInt(a.split('x')[0], 10);
    const nb = parseInt(b.split('x')[0], 10);
    return na - nb;
  });
  console.log(`[${label}]`);
  console.log(`  PNG blobs: ${pngs.length}  尺寸集合: ${dims.join(', ') || '(无)'}`);
  return { pngs, dims };
}

console.log('=== exe 内嵌 PNG 尺寸验证 ===\n');

const icoBuf = fs.readFileSync(path.join(root, 'resources', 'icon.ico'));
const icoSizes = parseIcoSizes(icoBuf);
console.log(`[resources/icon.ico 期望尺寸] ${icoSizes.join(', ')}\n`);

const baseline = analyze('基线 electron.exe', path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'));
const unpacked = analyze('win-unpacked exe', path.join(root, 'build', 'win-unpacked', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0.exe'));
analyze('portable exe', path.join(root, 'build', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-portable-x64.exe'));
analyze('nsis installer exe', path.join(root, 'build', '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-x64.exe'));

console.log('\n=== 判定 ===');
if (baseline && unpacked) {
  const expected = icoSizes.map((s) => s.split('@')[0]);
  const found = unpacked.dims;
  const matched = expected.filter((s) => found.includes(s));
  console.log(`  自定义图标期望尺寸: ${expected.join(', ')}`);
  console.log(`  win-unpacked 命中尺寸: ${matched.join(', ') || '(无)'}`);
  console.log(`  命中 ${matched.length}/${expected.length} 个尺寸 -> ${matched.length >= 5 ? '自定义图标已生效 ✓' : '可能未完全生效'}`);
}
