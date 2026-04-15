import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SUPPORTED_INPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'avif', 'heif', 'svg'];
const SUPPORTED_OUTPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'gif', 'avif', 'heif'];

function getFormatFromExtension(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return ext;
}

function parseRatio(ratioStr) {
  const parts = ratioStr.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const w = parseInt(parts[0], 10);
  const h = parseInt(parts[1], 10);
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return null;
  }
  return { width: w, height: h, value: w / h };
}

function validateRatio(ratioStr) {
  const result = parseRatio(ratioStr);
  if (!result) {
    return {
      valid: false,
      error: 'Invalid ratio format. Please use W:H format, e.g., 3:4, 16:9, 1:1'
    };
  }
  return { valid: true, ratio: result };
}

function parseSize(sizeStr) {
  const match = sizeStr.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return null;
  }
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function validateSize(sizeStr) {
  const result = parseSize(sizeStr);
  if (!result) {
    return {
      valid: false,
      error: 'Invalid size format. Please use WIDTHxHEIGHT format, e.g., 800x600'
    };
  }
  return { valid: true, size: result };
}

function calculateCropArea(width, height, targetRatio) {
  const currentRatio = width / height;

  let cropWidth, cropHeight;

  if (currentRatio > targetRatio) {
    cropHeight = height;
    cropWidth = Math.round(height * targetRatio);
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / targetRatio);
  }

  return {
    left: Math.round((width - cropWidth) / 2),
    top: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  };
}

function generateOutputFilename(inputPath, targetFormat, options = {}) {
  const { ratio = null, size = null } = options;
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const inputFormat = ext.toLowerCase().slice(1);
  const newExt = targetFormat === 'jpeg' ? '.jpg' : `.${targetFormat}`;

  let parts = [];
  if (ratio) {
    parts.push(`${ratio.width}-${ratio.height}`);
  }
  if (size) {
    parts.push(`${size.width}x${size.height}`);
  }

  const suffix = parts.length > 0 ? `_${parts.join('_')}` : '';
  const newFilename = `${basename}_${inputFormat}${suffix}${newExt}`;
  return path.join(dir, newFilename);
}

async function convertFile(inputPath, targetFormat, options = {}) {
  const { quality = 85, skipExisting = true, ratio = null, size = null } = options;

  if (!fs.existsSync(inputPath)) {
    return { success: false, error: 'File not found', path: inputPath };
  }

  const inputFormat = getFormatFromExtension(inputPath);
  if (!SUPPORTED_INPUT_FORMATS.includes(inputFormat)) {
    return { success: false, error: 'Unsupported input format', path: inputPath };
  }

  if (!SUPPORTED_OUTPUT_FORMATS.includes(targetFormat)) {
    return { success: false, error: 'Unsupported output format', path: inputPath };
  }

  if (ratio) {
    const validation = validateRatio(ratio);
    if (!validation.valid) {
      return { success: false, error: validation.error, path: inputPath };
    }
  }

  if (size) {
    const validation = validateSize(size);
    if (!validation.valid) {
      return { success: false, error: validation.error, path: inputPath };
    }
  }

  const outputPath = generateOutputFilename(inputPath, targetFormat, { ratio, size });

  if (skipExisting && fs.existsSync(outputPath)) {
    return { success: false, error: 'Skipped (already exists)', path: inputPath, outputPath };
  }

  try {
    const pipeline = sharp(inputPath);

    if (ratio) {
      const metadata = await pipeline.metadata();
      const crop = calculateCropArea(metadata.width, metadata.height, ratio.value);
      pipeline.extract(crop);
    }

    if (size) {
      pipeline.resize(size.width, size.height, { fit: 'inside' });
    }

    const sharpOptions = { quality };
    if (targetFormat === 'png') {
      sharpOptions.compressionLevel = 9;
    } else if (targetFormat === 'webp') {
      sharpOptions.lossless = quality === 100;
    } else if (targetFormat === 'avif') {
      sharpOptions.quality = quality;
      sharpOptions.lossless = quality === 100;
    } else if (targetFormat === 'heif') {
      sharpOptions.quality = quality;
      sharpOptions.lossless = quality === 100;
    }

    await pipeline.toFormat(targetFormat, sharpOptions).toFile(outputPath);

    return { success: true, path: inputPath, outputPath };
  } catch (error) {
    return { success: false, error: error.message, path: inputPath };
  }
}

async function convertDirectory(dirPath, targetFormat, options = {}) {
  const { quality = 85, skipExisting = true, recursive = false, ratio = null, size = null } = options;

  if (!fs.existsSync(dirPath)) {
    return { success: false, error: 'Directory not found', results: [] };
  }

  if (!fs.statSync(dirPath).isDirectory()) {
    return { success: false, error: 'Path is not a directory', results: [] };
  }

  const files = fs.readdirSync(dirPath);
  const imageFiles = files.filter(file => {
    const ext = getFormatFromExtension(file);
    return SUPPORTED_INPUT_FORMATS.includes(ext);
  });

  const results = [];

  for (const file of imageFiles) {
    const inputPath = path.join(dirPath, file);
    const stat = fs.statSync(inputPath);

    if (stat.isDirectory() && recursive) {
      const subResults = await convertDirectory(inputPath, targetFormat, options);
      results.push(...subResults.results);
    } else if (!stat.isDirectory()) {
      const result = await convertFile(inputPath, targetFormat, { quality, skipExisting, ratio, size });
      results.push(result);
    }
  }

  return { results };
}

function getSupportedFormats() {
  return {
    input: [...SUPPORTED_INPUT_FORMATS],
    output: [...SUPPORTED_OUTPUT_FORMATS]
  };
}

export {
  convertFile,
  convertDirectory,
  getSupportedFormats,
  generateOutputFilename,
  parseRatio,
  validateRatio,
  parseSize,
  validateSize
};
