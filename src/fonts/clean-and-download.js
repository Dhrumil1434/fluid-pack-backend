/**
 * Clean and re-download fonts script
 * Use this if fonts are corrupted or invalid
 * Run: node src/fonts/clean-and-download.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const fontsDir = __dirname;
const fontFiles = [
  'Roboto-Regular.ttf',
  'Roboto-Bold.ttf',
  'Roboto-Italic.ttf',
  'Roboto-Medium.ttf',
];

console.log('🧹 Cleaning existing font files...\n');

// Delete existing font files
fontFiles.forEach((font) => {
  const filepath = path.join(fontsDir, font);
  if (fs.existsSync(filepath)) {
    try {
      fs.unlinkSync(filepath);
      console.log(`✓ Deleted ${font}`);
    } catch (err) {
      console.error(`✗ Failed to delete ${font}:`, err.message);
    }
  }
});

console.log('\n📥 Now downloading fresh fonts...\n');

// Run the download script

require('./download-fonts.js');
