#!/usr/bin/env node

import { convertFile, convertDirectory, getSupportedFormats } from './src/converter.js';

async function main() {
  const input = JSON.parse(process.argv[2] || '{}');
  const { action, path, format, options } = input;

  try {
    if (action === 'formats') {
      const result = getSupportedFormats();
      console.log(JSON.stringify({ success: true, data: result }));
    } else if (action === 'convert') {
      const result = await convertFile(path, format, options || {});
      console.log(JSON.stringify(result));
    } else if (action === 'convertDir') {
      const result = await convertDirectory(path, format, options || {});
      console.log(JSON.stringify(result));
    } else {
      console.log(JSON.stringify({ success: false, error: 'Unknown action: ' + action }));
      process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
}

main();
