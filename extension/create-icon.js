const sharp = require('sharp');
const fs = require('fs');

if (!fs.existsSync('assets')) {
    fs.mkdirSync('assets');
}

// Create a nice SVG icon
const svgImage = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#grad1)" />
  <circle cx="256" cy="256" r="180" fill="white" opacity="0.2" />
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="280" fill="white">AI</text>
</svg>
`;

sharp(Buffer.from(svgImage))
    .png()
    .toFile('assets/icon.png')
    .then(() => console.log('✅ New AI Icon generated successfully at assets/icon.png'))
    .catch(err => {
        console.error('❌ Failed to create icon:', err);
        process.exit(1);
    });
