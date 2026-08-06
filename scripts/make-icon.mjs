import fs from 'fs'
import path from 'path'

// 生成一个合法的 256x256 / 32bpp Windows .ico（纯 Node，无需第三方依赖）
const W = 256
const H = 256
const px = Buffer.alloc(W * H * 4)
const R = 0x4f
const G = 0x8c
const B = 0xff
for (let i = 0; i < W * H; i++) {
  const x = i % W
  const y = Math.floor(i / W)
  const dx = x - W / 2
  const dy = y - H / 2
  const d = Math.sqrt(dx * dx + dy * dy)
  let r = R
  let g = G
  let b = B
  if (d < W / 3) {
    r = 0x6f
    g = 0xa8
    b = 0xff
  }
  const o = i * 4
  px[o] = b
  px[o + 1] = g
  px[o + 2] = r
  px[o + 3] = 0xff
}

// 1bpp AND 掩码（全 0 = 不透明）
const andMask = Buffer.alloc(Math.ceil(W / 32) * 4 * H, 0)

const bih = Buffer.alloc(40)
bih.writeUInt32LE(40, 0)
bih.writeInt32LE(W, 4)
bih.writeInt32LE(H * 2, 8) // 高度翻倍（XOR + AND）
bih.writeUInt16LE(1, 12)
bih.writeUInt16LE(32, 14)
bih.writeUInt32LE(0, 16)
bih.writeUInt32LE(px.length, 20)
bih.writeInt32LE(0, 24)
bih.writeInt32LE(0, 28)
bih.writeUInt32LE(0, 32)
bih.writeUInt32LE(0, 36)

const image = Buffer.concat([bih, px, andMask])

const id = Buffer.alloc(6)
id.writeUInt16LE(0, 0)
id.writeUInt16LE(1, 2)
id.writeUInt16LE(1, 4)

const entry = Buffer.alloc(16)
entry.writeUInt8(W >= 256 ? 0 : W, 0)
entry.writeUInt8(H >= 256 ? 0 : H, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(image.length, 8)
entry.writeUInt32LE(6 + 16, 12)

const ico = Buffer.concat([id, entry, image])
const out = path.join(process.cwd(), 'resources', 'icon.ico')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, ico)
console.log('wrote', out, ico.length, 'bytes')
