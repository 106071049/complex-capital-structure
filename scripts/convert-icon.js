const sharp = require('sharp');
const fs = require('fs');

async function convertIcon() {
  const inputPath = 'd:/allocation-payoff-triangle/public/louis-logo.png';
  
  // Generate 32x32 icons for light and dark mode
  await sharp(inputPath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('d:/allocation-payoff-triangle/public/icon-light-32x32.png');
  
  await sharp(inputPath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('d:/allocation-payoff-triangle/public/icon-dark-32x32.png');
  
  // Generate Apple icon (180x180)
  await sharp(inputPath)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('d:/allocation-payoff-triangle/public/apple-icon.png');
  
  console.log('Icons generated successfully!');
}

convertIcon().catch(console.error);
