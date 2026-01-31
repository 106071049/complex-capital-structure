const sharp = require('sharp');

async function createFavicon() {
  const inputPath = 'd:/allocation-payoff-triangle/public/louis-logo.png';
  
  // Generate favicon.ico (16x16)
  await sharp(inputPath)
    .resize(16, 16, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('d:/allocation-payoff-triangle/public/favicon.ico');
  
  console.log('Favicon created successfully!');
}

createFavicon().catch(console.error);
