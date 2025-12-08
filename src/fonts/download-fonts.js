/**
 * Script to download Roboto fonts for PDF generation
 * Run: node src/fonts/download-fonts.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const fontsDir = __dirname;

// Using raw.githubusercontent.com for direct file access (more reliable)
const fonts = [
  {
    name: 'Roboto-Regular.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
  },
  {
    name: 'Roboto-Bold.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Bold.ttf',
  },
  {
    name: 'Roboto-Italic.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Italic.ttf',
  },
  {
    name: 'Roboto-Medium.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Medium.ttf',
  },
];

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    const request = protocol.get(url, (response) => {
      // Check if response is successful
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(
          new Error(
            `Failed to download: ${response.statusCode} ${response.statusMessage}`,
          ),
        );
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'];
      if (
        contentType &&
        !contentType.includes('font') &&
        !contentType.includes('octet-stream') &&
        !contentType.includes('application')
      ) {
        console.warn(`⚠️  Warning: Unexpected content type: ${contentType}`);
      }

      // Get file size
      const contentLength = parseInt(
        response.headers['content-length'] || '0',
        10,
      );
      // Note: downloadedBytes tracking removed as it was unused

      // response.on('data', (chunk) => {
      //   downloadedBytes += chunk.length;
      // });

      response.pipe(file);

      file.on('finish', () => {
        file.close();

        // Verify file was downloaded correctly
        const stats = fs.statSync(filepath);
        if (stats.size === 0) {
          fs.unlinkSync(filepath);
          reject(new Error('Downloaded file is empty'));
          return;
        }

        // Check if file starts with TTF magic bytes (0x00010000 or 'OTTO' for OTF)
        const buffer = fs.readFileSync(filepath, { start: 0, end: 4 });
        const isTTF =
          buffer[0] === 0x00 &&
          buffer[1] === 0x01 &&
          buffer[2] === 0x00 &&
          buffer[3] === 0x00;
        const isOTF = buffer.toString('ascii', 0, 4) === 'OTTO';

        if (!isTTF && !isOTF) {
          console.warn(
            `⚠️  Warning: File ${path.basename(filepath)} might not be a valid font file`,
          );
          console.warn(`   First bytes: ${buffer.toString('hex')}`);
        }

        resolve({
          size: stats.size,
          expectedSize: contentLength,
          isValid: isTTF || isOTF,
        });
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

async function downloadFonts() {
  console.log('📥 Downloading Roboto fonts for PDF generation...\n');

  let successCount = 0;
  let failCount = 0;

  for (const font of fonts) {
    const filepath = path.join(fontsDir, font.name);

    // Skip if already exists and is valid
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      if (stats.size > 0) {
        // Verify it's a valid font file
        try {
          const buffer = fs.readFileSync(filepath, { start: 0, end: 4 });
          const isTTF =
            buffer[0] === 0x00 &&
            buffer[1] === 0x01 &&
            buffer[2] === 0x00 &&
            buffer[3] === 0x00;
          const isOTF = buffer.toString('ascii', 0, 4) === 'OTTO';

          if (isTTF || isOTF) {
            console.log(
              `✓ ${font.name} already exists and is valid, skipping...`,
            );
            successCount++;
            continue;
          } else {
            console.log(
              `⚠️  ${font.name} exists but appears invalid, re-downloading...`,
            );
            fs.unlinkSync(filepath);
          }
        } catch {
          console.log(
            `⚠️  ${font.name} exists but couldn't verify, re-downloading...`,
          );
          fs.unlinkSync(filepath);
        }
      }
    }

    try {
      console.log(`⬇️  Downloading ${font.name}...`);
      const result = await downloadFile(font.url, filepath);
      if (result.isValid) {
        console.log(
          `✅ ${font.name} downloaded successfully (${(result.size / 1024).toFixed(2)} KB)\n`,
        );
        successCount++;
      } else {
        console.warn(
          `⚠️  ${font.name} downloaded but format verification failed`,
        );
        console.warn(`   File size: ${result.size} bytes`);
        console.warn(`   Please verify the file manually\n`);
        failCount++;
      }
    } catch (error) {
      console.error(`❌ Failed to download ${font.name}:`, error.message);
      console.error(`   URL: ${font.url}\n`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (successCount === fonts.length) {
    console.log('✨ All fonts downloaded successfully!');
  } else {
    console.log(`⚠️  Downloaded ${successCount}/${fonts.length} fonts`);
    if (failCount > 0) {
      console.log('\n📝 Manual download instructions:');
      console.log('   1. Visit: https://fonts.google.com/specimen/Roboto');
      console.log('   2. Click "Download family"');
      console.log('   3. Extract the ZIP file');
      console.log('   4. Copy the following files to src/fonts/:');
      fonts.forEach((font) => {
        console.log(`      - ${font.name}`);
      });
    }
  }
  console.log('='.repeat(50) + '\n');
}

downloadFonts().catch(console.error);
