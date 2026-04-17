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

function parseAngle(angleStr) {
  const angle = parseFloat(angleStr);
  if (isNaN(angle) || angle < -360 || angle > 360) {
    return null;
  }
  return angle;
}

function validateAngle(angleStr) {
  const result = parseAngle(angleStr);
  if (result === null) {
    return {
      valid: false,
      error: 'Invalid angle. Please use a number between -360 and 360 (e.g., 90, -45, 180)'
    };
  }
  return { valid: true, angle: result };
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
  const { ratio = null, size = null, flipH = false, flipV = false, angle = null, watermark = null } = options;
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
  if (flipH) parts.push('flipH');
  if (flipV) parts.push('flipV');
  if (angle !== null && angle !== 0) {
    const sign = angle > 0 ? '' : 'n';
    parts.push(`r${sign}${Math.abs(angle)}`);
  }
  if (watermark) {
    if (watermark.text) {
      parts.push(`wm_${watermark.text.substring(0, 10)}`);
    } else if (watermark.image) {
      parts.push('wm_img');
    }
  }

  const suffix = parts.length > 0 ? `_${parts.join('_')}` : '';
  const newFilename = `${basename}_${inputFormat}${suffix}${newExt}`;
  return path.join(dir, newFilename);
}

async function convertFile(inputPath, targetFormat, options = {}) {
  const { quality = 85, skipExisting = true, ratio = null, size = null, flipH = false, flipV = false, angle = null, watermark = null } = options;

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

  if (angle !== null) {
    const validation = validateAngle(angle);
    if (!validation.valid) {
      return { success: false, error: validation.error, path: inputPath };
    }
  }

  const outputPath = generateOutputFilename(inputPath, targetFormat, { ratio, size, flipH, flipV, angle, watermark });

  if (skipExisting && fs.existsSync(outputPath)) {
    return { success: false, error: 'Skipped (already exists)', path: inputPath, outputPath };
  }

  try {
    const pipeline = sharp(inputPath);
    const metadata = await pipeline.metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    if (ratio) {
      const crop = calculateCropArea(originalWidth, originalHeight, ratio.value);
      pipeline.extract(crop);
    }

    if (flipH) pipeline.flop();
    if (flipV) pipeline.flip();
    if (angle !== null && angle !== 0) pipeline.rotate(angle);

    if (size) {
      pipeline.resize(size.width, size.height, { fit: 'inside' });
    }

    if (watermark) {
      const imgWidth = originalWidth;
      const imgHeight = originalHeight;

      if (watermark.text) {
        const fontSize = Math.round(Math.min(imgWidth, imgHeight) * 0.04);
        const textLength = Math.round(watermark.text.length * fontSize * 0.6);
        const padding = Math.round(fontSize * 0.5);
        const wmWidth = Math.round(textLength + padding * 2);
        const wmHeight = Math.round(fontSize * 1.5);
        const wmLeft = Math.round(imgWidth - wmWidth - padding);
        const wmTop = Math.round(imgHeight - wmHeight - padding);

        const textSvg = `
          <svg width="${wmWidth}" height="${wmHeight}">
            <style>
              .watermark {
                fill: ${watermark.color || 'rgba(255,255,255,0.7)'};
                font-size: ${fontSize}px;
                font-family: Arial, sans-serif;
                font-weight: bold;
              }
            </style>
            <text x="${padding}" y="${wmHeight / 2}" dy=".35em" class="watermark">${escapeXml(watermark.text)}</text>
          </svg>
        `;
        const wmBuffer = Buffer.from(textSvg);
        pipeline.composite([{ input: wmBuffer, left: wmLeft, top: wmTop }]);
      } else if (watermark.image) {
        const wmImage = sharp(watermark.image);
        const wmMeta = await wmImage.metadata();
        const wmScale = watermark.scale || 0.2;
        const wmWidth = Math.round(imgWidth * wmScale);
        const wmHeight = Math.round(wmMeta.height * (wmWidth / wmMeta.width));

        const position = watermark.position || 'bottom-right';
        const gravity = getGravity(position);

        pipeline.composite([{
          input: await wmImage.resize(wmWidth, wmHeight).toBuffer(),
          gravity: gravity,
          blend: 'overlay'
        }]);
      }
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
  const { quality = 85, skipExisting = true, recursive = false, ratio = null, size = null, flipH = false, flipV = false, angle = null, watermark = null } = options;

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
      const result = await convertFile(inputPath, targetFormat, { quality, skipExisting, ratio, size, flipH, flipV, angle, watermark });
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

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getGravity(position) {
  const map = {
    'top-left': 'northwest',
    'top': 'north',
    'top-right': 'northeast',
    'left': 'west',
    'center': 'centre',
    'right': 'east',
    'bottom-left': 'southwest',
    'bottom': 'south',
    'bottom-right': 'southeast'
  };
  return map[position] || 'southeast';
}

export {
  convertFile,
  convertDirectory,
  getSupportedFormats,
  generateOutputFilename,
  parseRatio,
  validateRatio,
  parseSize,
  validateSize,
  parseAngle,
  validateAngle
};
