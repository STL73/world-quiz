#!/usr/bin/env node
// tools/compress-images.js
//
// Resize and re-encode every JPEG in src/Images/** in place.
// - Max width 1600px (preserves aspect ratio, never upscales)
// - JPEG quality 82, progressive, mozjpeg encoder
// - Prints before/after size per file plus a totals summary
//
// Usage: npm run compress-images
//
// Safe to re-run: idempotent for already-shrunk images (sharp's resize
// with `withoutEnlargement: true` skips upscaling).

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const IMAGES_DIR = path.join(__dirname, '..', 'src', 'Images');
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.jpe?g$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function compressOne(file) {
  const before = (await fs.stat(file)).size;

  // sharp doesn't support reading and writing the same file in one pipeline,
  // so process to a temp file then atomically replace.
  const tmp = `${file}.tmp`;
  await sharp(file)
    .rotate() // honor EXIF orientation before stripping metadata
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
    .toFile(tmp);

  await fs.rename(tmp, file);
  const after = (await fs.stat(file)).size;
  return { before, after };
}

async function main() {
  console.log(`Scanning ${IMAGES_DIR}...`);
  const files = await walk(IMAGES_DIR);
  console.log(`Found ${files.length} JPEGs to process.\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;

  for (const file of files) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    try {
      const { before, after } = await compressOne(file);
      totalBefore += before;
      totalAfter += after;
      processed++;
      const saved = before - after;
      const pct = before > 0 ? ((saved / before) * 100).toFixed(1) : '0.0';
      console.log(
        `  ${rel}\n    ${formatBytes(before)} -> ${formatBytes(after)}  (-${pct}%)`
      );
    } catch (err) {
      console.error(`  FAILED  ${rel}: ${err.message}`);
    }
  }

  const totalSaved = totalBefore - totalAfter;
  const totalPct = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : '0.0';
  console.log('\n─────────────────────────────────────────────');
  console.log(`Processed:     ${processed} / ${files.length}`);
  console.log(`Total before:  ${formatBytes(totalBefore)}`);
  console.log(`Total after:   ${formatBytes(totalAfter)}`);
  console.log(`Saved:         ${formatBytes(totalSaved)}  (-${totalPct}%)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
