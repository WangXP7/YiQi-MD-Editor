const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule.imagesToIco || pngToIcoModule;
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const svgPath = path.join(publicDir, 'icon.svg');
const pngPath = path.join(publicDir, 'icon.png');
const icoPath = path.join(publicDir, 'icon.ico');

// Sizes needed for Windows icon
const sizes = [16, 32, 48, 64, 128, 256];

async function generateIcon() {
  console.log('Reading SVG icon...');
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Generate PNG at 256x256
  console.log('Generating 256x256 PNG...');
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(pngPath);
  console.log('PNG icon created at:', pngPath);
  
  // Generate multi-size ICO
  console.log('Generating multi-size ICO...');
  const pngBuffers = [];
  for (const size of sizes) {
    const buffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buffer);
    console.log(`  Generated ${size}x${size}`);
  }
  
  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('ICO icon created at:', icoPath);
  console.log('Icon generation complete!');
}

generateIcon().catch(err => {
  console.error('Error generating icon:', err);
  process.exit(1);
});
