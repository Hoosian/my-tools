#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import { convertFile, convertDirectory, getSupportedFormats, generateOutputFilename, parseRatio, parseSize, validateAngle } from './converter.js';

const program = new Command();

program
  .name('imageTools')
  .description('Image format conversion tool')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert image(s) to specified format')
  .argument('<path>', 'File or directory path')
  .option('-f, --format <format>', 'Target format (jpg, png, webp, etc.)')
  .option('-q, --quality <number>', 'Quality (1-100)', '85')
  .option('-r, --recursive', 'Convert subdirectories recursively', false)
  .option('--ratio <ratio>', 'Crop to aspect ratio (e.g., 3:4, 16:9, 1:1)')
  .option('--size <size>', 'Scale to fit within WxH (e.g., 800x600)')
  .option('--flip-h', 'Flip image horizontally (left-right mirror)', false)
  .option('--flip-v', 'Flip image vertically (top-bottom mirror)', false)
  .option('--rotate <angle>', 'Rotate image by angle in degrees (e.g., 90, -45, 180)', parseFloat)
  .action(async (inputPath, options) => {
    const { format, quality, recursive, ratio, size, flipH, flipV, rotate } = options;

    if (!format) {
      console.error('Error: --format is required');
      process.exit(1);
    }

    const qualityNum = parseInt(quality);
    if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
      console.error('Error: Quality must be between 1 and 100');
      process.exit(1);
    }

    const ratioObj = ratio ? parseRatio(ratio) : null;
    if (ratio && !ratioObj) {
      console.error('Error: Invalid ratio format. Use W:H format (e.g., 3:4, 16:9, 1:1)');
      process.exit(1);
    }

    const sizeObj = size ? parseSize(size) : null;
    if (size && !sizeObj) {
      console.error('Error: Invalid size format. Use WIDTHxHEIGHT (e.g., 800x600)');
      process.exit(1);
    }

    const angle = rotate !== undefined ? rotate : null;
    if (angle !== null) {
      const validation = validateAngle(angle);
      if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
      }
    }

    const opts = { quality: qualityNum, skipExisting: true, recursive, ratio: ratioObj, size: sizeObj, flipH, flipV, angle };

    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Path not found: ${inputPath}`);
      process.exit(1);
    }

    const stat = fs.statSync(inputPath);

    if (stat.isDirectory()) {
      let msg = `Converting all images in directory: ${inputPath}`;
      msg += `\nTarget format: ${format}, Quality: ${qualityNum}`;
      if (ratioObj) msg += `, Ratio: ${ratio}`;
      if (sizeObj) msg += `, Size: ${size}`;
      if (flipH) msg += ', Flip Horizontal';
      if (flipV) msg += ', Flip Vertical';
      if (angle !== null) msg += `, Rotate: ${angle}`;
      console.log(msg + '\n');

      const { results } = await convertDirectory(inputPath, format, opts);

      const succeeded = results.filter(r => r.success).length;
      const skipped = results.filter(r => r.error === 'Skipped (already exists)').length;
      const failed = results.filter(r => !r.success && r.error !== 'Skipped (already exists)').length;

      console.log(`\nResults: ${succeeded} converted, ${skipped} skipped, ${failed} failed`);

      if (failed > 0) {
        console.log('\nFailed files:');
        results.filter(r => !r.success && r.error !== 'Skipped (already exists)')
          .forEach(r => console.log(`  - ${r.path}: ${r.error}`));
      }
    } else {
      let msg = `Converting: ${inputPath}`;
      msg += `\nTarget format: ${format}, Quality: ${qualityNum}`;
      if (ratioObj) msg += `, Ratio: ${ratio}`;
      if (sizeObj) msg += `, Size: ${size}`;
      if (flipH) msg += ', Flip Horizontal';
      if (flipV) msg += ', Flip Vertical';
      if (angle !== null) msg += `, Rotate: ${angle}`;
      console.log(msg + '\n');

      const result = await convertFile(inputPath, format, opts);

      if (result.success) {
        console.log(`Success!`);
        console.log(`Output: ${result.outputPath}`);
      } else if (result.error === 'Skipped (already exists)') {
        console.log(`Skipped: ${result.outputPath} (already exists)`);
      } else {
        console.error(`Failed: ${result.error}`);
        process.exit(1);
      }
    }
  });

program
  .command('formats')
  .description('List supported formats')
  .action(() => {
    const { input, output } = getSupportedFormats();
    console.log('Supported input formats:');
    console.log(`  ${input.join(', ')}`);
    console.log('\nSupported output formats:');
    console.log(`  ${output.join(', ')}`);
  });

program
  .command('preview')
  .description('Preview conversion output filename')
  .argument('<file>', 'Input file path')
  .argument('<format>', 'Target format')
  .action((inputFile, targetFormat) => {
    if (!fs.existsSync(inputFile)) {
      console.error(`Error: File not found: ${inputFile}`);
      process.exit(1);
    }
    const outputPath = generateOutputFilename(inputFile, targetFormat);
    console.log(`Input:  ${inputFile}`);
    console.log(`Output: ${outputPath}`);
  });

async function interactiveMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Convert single file', value: 'single' },
        { name: 'Convert all images in directory', value: 'dir' },
        { name: 'Preview output filename', value: 'preview' },
        { name: 'List supported formats', value: 'formats' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') {
    return;
  }

  if (action === 'formats') {
    const { input, output } = getSupportedFormats();
    console.log('\nSupported input formats:');
    console.log(`  ${input.join(', ')}`);
    console.log('\nSupported output formats:');
    console.log(`  ${output.join(', ')}\n`);
    return interactiveMenu();
  }

  if (action === 'preview') {
    const { inputFile, format } = await inquirer.prompt([
      { type: 'input', name: 'inputFile', message: 'Input file path:' },
      { type: 'input', name: 'format', message: 'Target format:' }
    ]);
    if (fs.existsSync(inputFile)) {
      const outputPath = generateOutputFilename(inputFile, format);
      console.log(`\nInput:  ${inputFile}`);
      console.log(`Output: ${outputPath}\n`);
    } else {
      console.error(`Error: File not found: ${inputFile}`);
    }
    return interactiveMenu();
  }

  if (action === 'single') {
    const { inputFile, format, quality, ratio, size, flipH, flipV, rotate } = await inquirer.prompt([
      { type: 'input', name: 'inputFile', message: 'Input file path:' },
      { type: 'input', name: 'format', message: 'Target format (e.g., jpg, png, webp):' },
      { type: 'input', name: 'quality', message: 'Quality (1-100):', default: '85' },
      { type: 'input', name: 'ratio', message: 'Crop ratio (e.g., 3:4, 16:9, leave blank to skip):', default: '' },
      { type: 'input', name: 'size', message: 'Max size WxH (e.g., 800x600, leave blank to skip):', default: '' },
      { type: 'confirm', name: 'flipH', message: 'Flip horizontally (left-right mirror)?', default: false },
      { type: 'confirm', name: 'flipV', message: 'Flip vertically (top-bottom mirror)?', default: false },
      { type: 'input', name: 'rotate', message: 'Rotate angle in degrees (e.g., 90, -45, leave blank for no rotation):', default: '' }
    ]);

    const qualityNum = parseInt(quality) || 85;
    const ratioObj = ratio ? parseRatio(ratio) : null;
    const sizeObj = size ? parseSize(size) : null;
    const angle = rotate ? parseFloat(rotate) : null;

    const result = await convertFile(inputFile, format, { quality: qualityNum, skipExisting: true, ratio: ratioObj, size: sizeObj, flipH, flipV, angle });

    if (result.success) {
      console.log(`\nSuccess!`);
      console.log(`Output: ${result.outputPath}\n`);
    } else if (result.error === 'Skipped (already exists)') {
      console.log(`\nSkipped: ${result.outputPath} (already exists)\n`);
    } else {
      console.error(`\nFailed: ${result.error}\n`);
    }
    return interactiveMenu();
  }

  if (action === 'dir') {
    const { dirPath, format, quality, recursive, ratio, size, flipH, flipV, rotate } = await inquirer.prompt([
      { type: 'input', name: 'dirPath', message: 'Directory path:' },
      { type: 'input', name: 'format', message: 'Target format (e.g., jpg, png, webp):' },
      { type: 'input', name: 'quality', message: 'Quality (1-100):', default: '85' },
      { type: 'confirm', name: 'recursive', message: 'Convert subdirectories recursively?', default: false },
      { type: 'input', name: 'ratio', message: 'Crop ratio (e.g., 3:4, 16:9, leave blank to skip):', default: '' },
      { type: 'input', name: 'size', message: 'Max size WxH (e.g., 800x600, leave blank to skip):', default: '' },
      { type: 'confirm', name: 'flipH', message: 'Flip horizontally (left-right mirror)?', default: false },
      { type: 'confirm', name: 'flipV', message: 'Flip vertically (top-bottom mirror)?', default: false },
      { type: 'input', name: 'rotate', message: 'Rotate angle in degrees (e.g., 90, -45, leave blank for no rotation):', default: '' }
    ]);

    const qualityNum = parseInt(quality) || 85;
    const ratioObj = ratio ? parseRatio(ratio) : null;
    const sizeObj = size ? parseSize(size) : null;
    const angle = rotate ? parseFloat(rotate) : null;

    let msg = `\nConverting all images in: ${dirPath}`;
    msg += `\nTarget format: ${format}, Quality: ${qualityNum}`;
    if (ratioObj) msg += `, Ratio: ${ratio}`;
    if (sizeObj) msg += `, Size: ${size}`;
    if (flipH) msg += ', Flip Horizontal';
    if (flipV) msg += ', Flip Vertical';
    if (angle !== null) msg += `, Rotate: ${angle}`;
    console.log(msg + '\n');

    const { results } = await convertDirectory(dirPath, format, {
      quality: qualityNum,
      skipExisting: true,
      recursive,
      ratio: ratioObj,
      size: sizeObj,
      flipH,
      flipV,
      angle
    });

    const succeeded = results.filter(r => r.success).length;
    const skipped = results.filter(r => r.error === 'Skipped (already exists)').length;
    const failed = results.filter(r => !r.success && r.error !== 'Skipped (already exists)').length;

    console.log(`\nResults: ${succeeded} converted, ${skipped} skipped, ${failed} failed\n`);

    if (failed > 0) {
      console.log('Failed files:');
      results.filter(r => !r.success && r.error !== 'Skipped (already exists)')
        .forEach(r => console.log(`  - ${r.path}: ${r.error}`));
      console.log('');
    }

    return interactiveMenu();
  }
}

if (process.argv.length === 2) {
  interactiveMenu();
} else {
  program.parse(process.argv);
}
