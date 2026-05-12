#!/usr/bin/env node
// tools/split-css.js
//
// One-shot script: split src/CSS/style.css into modular files in
// src/CSS/modules/, then rewrite style.css as an @import aggregator.
//
// Verifies byte-for-byte that the concatenation of the modules
// matches the original file before writing anything. Aborts on
// mismatch so the original is never destroyed without a safety check.
//
// Usage: node tools/split-css.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'src', 'CSS');
const SOURCE = path.join(CSS_DIR, 'style.css');
const MODULES_DIR = path.join(CSS_DIR, 'modules');

// Line ranges are 1-indexed and inclusive. Each block ends on the blank
// line immediately before the next section's header comment, so the
// concatenated output is byte-identical to the original.
const MODULES = [
  { name: '01-base.css',        startLine: 1,    endLine: 1526 },
  { name: '02-responsive.css',  startLine: 1527, endLine: 1817 },
  { name: '03-admin.css',       startLine: 1818, endLine: 2583 },
  { name: '04-quiz.css',        startLine: 2584, endLine: 2956 },
  { name: '05-dashboard.css',   startLine: 2957, endLine: 3151 },
  { name: '06-landing.css',     startLine: 3152, endLine: 4031 },
  { name: '07-polish.css',      startLine: 4032, endLine: 4966 },
];

function main() {
  const original = fs.readFileSync(SOURCE, 'utf8');
  // Preserve line endings exactly by splitting on \n and rejoining.
  // Windows checkout uses CRLF but text=auto in .gitattributes normalizes
  // to LF in the repo. The script operates on whatever the working tree has.
  const lines = original.split('\n');
  const totalLines = lines.length;

  // Sanity check: last range must end at or just past total line count.
  const lastEnd = MODULES[MODULES.length - 1].endLine;
  if (lastEnd > totalLines) {
    console.error(`ERROR: last endLine ${lastEnd} exceeds file length ${totalLines}`);
    process.exit(1);
  }

  // Pull each slice. Array indices are 0-based; line N is at index N-1.
  // Slice the trailing tail (anything after the last endLine) into the
  // final module so nothing is dropped.
  const slices = MODULES.map((mod, i) => {
    const startIdx = mod.startLine - 1;
    const isLast = i === MODULES.length - 1;
    const endIdx = isLast ? lines.length : mod.endLine; // exclusive for slice
    const moduleLines = lines.slice(startIdx, endIdx);
    return { ...mod, content: moduleLines.join('\n') };
  });

  // Verification: joining all slices with '\n' between consecutive slices
  // reproduces the original. Since slice boundaries fall on blank lines,
  // the newline separator IS part of the split — careful here.
  // Strategy: concat slices in order, no extra glue. The last line of
  // slice N and the first line of slice N+1 in the joined string must
  // restore the original \n that was consumed by split.
  const concatenated = slices.map((s, i) => {
    // Every slice except the last needs a trailing \n to reattach to the
    // next slice's first line.
    return s.content + (i < slices.length - 1 ? '\n' : '');
  }).join('');

  if (concatenated !== original) {
    console.error('ERROR: concatenated output does not match original.');
    console.error(`  original length:     ${original.length}`);
    console.error(`  concatenated length: ${concatenated.length}`);
    // Find first byte that differs.
    const minLen = Math.min(original.length, concatenated.length);
    for (let i = 0; i < minLen; i++) {
      if (original[i] !== concatenated[i]) {
        console.error(`  first diff at byte ${i}`);
        console.error(`  original: ${JSON.stringify(original.slice(Math.max(0, i - 30), i + 30))}`);
        console.error(`  concat  : ${JSON.stringify(concatenated.slice(Math.max(0, i - 30), i + 30))}`);
        break;
      }
    }
    process.exit(1);
  }

  console.log('Verification passed: split slices reconstruct the original byte-for-byte.');

  // Ensure modules directory exists.
  fs.mkdirSync(MODULES_DIR, { recursive: true });

  // Write each module file.
  for (const slice of slices) {
    const out = path.join(MODULES_DIR, slice.name);
    fs.writeFileSync(out, slice.content, 'utf8');
    const sizeKb = (Buffer.byteLength(slice.content, 'utf8') / 1024).toFixed(1);
    const lineCount = slice.content.split('\n').length;
    console.log(`  wrote ${path.relative(ROOT, out)}  (${lineCount} lines, ${sizeKb} KB)`);
  }

  // Rewrite style.css as a thin aggregator.
  const aggregator = [
    '/* style.css — module aggregator.',
    ' *',
    ' * The actual CSS lives in ./modules/. Each @import is loaded in source',
    ' * order so the cascade is identical to the pre-split monolith.',
    ' *',
    ' * Cache-busting works on this file as before: every <link> in the PHP',
    ' * pages still appends ?v=filemtime("CSS/style.css") and that bumps',
    ' * whenever any module is edited (because style.css must be edited too',
    ' * to register the change — or just `touch` it after editing a module).',
    ' */',
    '',
    ...slices.map((s) => `@import url("./modules/${s.name}");`),
    '',
  ].join('\n');

  fs.writeFileSync(SOURCE, aggregator, 'utf8');
  console.log(`\n  wrote ${path.relative(ROOT, SOURCE)}  (aggregator, ${aggregator.split('\n').length} lines)`);

  console.log('\nDone. Visual regression check the app in a browser before committing.');
}

main();
