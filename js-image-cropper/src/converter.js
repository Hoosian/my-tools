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
  let { quality = 85, skipExisting = true, ratio = null, size = null, flipH = false, flipV = false, angle = null, watermark = null } = options;

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
    if (typeof ratio === 'string') {
      const validation = validateRatio(ratio);
      if (!validation.valid) {
        return { success: false, error: validation.error, path: inputPath };
      }
      ratio = validation.ratio;
    } else if (typeof ratio === 'object' && ratio.value) {
      // ratio 已经是解析后的对象
    } else {
      return { success: false, error: 'Invalid ratio format', path: inputPath };
    }
  }

  if (size) {
    if (typeof size === 'string') {
      const validation = validateSize(size);
      if (!validation.valid) {
        return { success: false, error: validation.error, path: inputPath };
      }
      size = validation.size;
    } else if (typeof size === 'object' && size.width && size.height) {
      // size 已经是解析后的对象
    } else {
      return { success: false, error: 'Invalid size format', path: inputPath };
    }
  }

  if (angle !== null) {
    if (typeof angle === 'string') {
      const validation = validateAngle(angle);
      if (!validation.valid) {
        return { success: false, error: validation.error, path: inputPath };
      }
      angle = validation.angle;
    } else if (typeof angle === 'number') {
      // angle 已经是数字
      if (angle < -360 || angle > 360) {
        return { success: false, error: 'Invalid angle. Please use a number between -360 and 360', path: inputPath };
      }
    } else {
      return { success: false, error: 'Invalid angle format', path: inputPath };
    }
  }

  const outputPath = generateOutputFilename(inputPath, targetFormat, { ratio, size, flipH, flipV, angle, watermark });

  if (skipExisting && fs.existsSync(outputPath)) {
    return { success: false, error: 'Skipped (already exists)', path: inputPath, outputPath };
  }

  try {
    let pipeline = sharp(inputPath);
    const metadata = await pipeline.metadata();

    if (ratio) {
      pipeline.extract(calculateCropArea(metadata.width, metadata.height, ratio.value));
    }

    if (flipH) pipeline.flop();
    if (flipV) pipeline.flip();
    if (angle !== null && angle !== 0) pipeline.rotate(angle);

    if (size) {
      pipeline.resize(size.width, size.height, { fit: 'inside' });
    }

    if (watermark) {
      // 先执行裁剪/旋转/缩放拿到真实尺寸（任意角度旋转会扩大画布，无法可靠地手算），再叠加水印
      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
      pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
      const imgWidth = info.width;
      const imgHeight = info.height;

      if (watermark.text) {
        const fontSize = Math.max(1, Math.round(Math.min(imgWidth, imgHeight) * 0.04));
        const padding = Math.round(fontSize * 0.5);
        const maxWidth = Math.round(imgWidth * 0.8);
        const lineWidth = maxWidth - padding * 2;
        const maxLines = 3;
        const lineHeight = Math.round(fontSize * 1.3);
        const ellipsis = '...';
        // 估算字符宽度：中日韩等全角字符约 1em，其余约 0.6em
        const charWidth = ch => (ch.codePointAt(0) >= 0x2e80 ? fontSize : fontSize * 0.6);
        const textWidth = str => Array.from(str).reduce((sum, ch) => sum + charWidth(ch), 0);
        // 截取能放进 limit 宽度的最长前缀（至少保留 1 个字符）
        const fitPrefix = (chars, limit) => {
          let width = 0;
          let count = 0;
          while (count < chars.length && width + charWidth(chars[count]) <= limit) {
            width += charWidth(chars[count]);
            count++;
          }
          return Math.max(1, count);
        };
        const truncate = str => {
          const chars = Array.from(str);
          if (textWidth(str) <= lineWidth) return str;
          return chars.slice(0, fitPrefix(chars, lineWidth - textWidth(ellipsis))).join('') + ellipsis;
        };

        let lines = [];
        if (watermark.fit === 'truncate') {
          // 单行截断模式
          lines = [truncate(watermark.text)];
        } else {
          // 自动换行模式（默认），超过 maxLines 行时最后一行加省略号
          let rest = Array.from(watermark.text);
          while (rest.length > 0 && lines.length < maxLines) {
            const count = fitPrefix(rest, lineWidth);
            lines.push(rest.slice(0, count).join(''));
            rest = rest.slice(count);
          }
          if (rest.length > 0) {
            lines[lines.length - 1] = truncate(lines[lines.length - 1] + rest.join(''));
          }
        }

        // 极小图片上水印区域不能超出图片本身，否则 sharp 合成会报错
        const wmWidth = Math.max(1, Math.min(maxWidth, imgWidth));
        const wmHeight = Math.max(1, Math.min(Math.round(lineHeight * lines.length + padding), imgHeight));
        const position = watermark.position || 'bottom-right';
        const pos = calculateTextPosition(imgWidth, imgHeight, wmWidth, wmHeight, padding, position);
        const wmLeft = Math.min(Math.max(0, pos.left), imgWidth - wmWidth);
        const wmTop = Math.min(Math.max(0, pos.top), imgHeight - wmHeight);

        // 文字在水印区域内按位置对齐：右侧位置右对齐，居中位置居中，否则左对齐
        const anchor = position.endsWith('right') ? 'end' : ['top', 'center', 'bottom'].includes(position) ? 'middle' : 'start';
        const textX = anchor === 'end' ? wmWidth - padding : anchor === 'middle' ? Math.round(wmWidth / 2) : padding;
        const tspanElements = lines.map(line => {
          return `            <tspan x="${textX}" dy="${lineHeight}">${escapeXml(line)}</tspan>`;
        }).join('\n');

        const textSvg = `
          <svg width="${wmWidth}" height="${wmHeight}">
            <style>
              .watermark {
                fill: ${safeColor(watermark.color)};
                font-size: ${fontSize}px;
                font-family: Arial, sans-serif;
                font-weight: bold;
              }
            </style>
            <text class="watermark" x="${textX}" y="0" text-anchor="${anchor}">
${tspanElements}
            </text>
          </svg>
        `;
        const wmBuffer = Buffer.from(textSvg);
        pipeline.composite([{ input: wmBuffer, left: wmLeft, top: wmTop }]);
      } else if (watermark.image) {
        const wmImage = sharp(watermark.image);
        const wmMeta = await wmImage.metadata();
        const wmScale = watermark.scale || 0.2;
        let wmWidth = Math.round(imgWidth * wmScale);
        let wmHeight = Math.round(wmMeta.height * (wmWidth / wmMeta.width));

        // 安全限制：水印尺寸不能超过处理后图片尺寸
        if (wmWidth > imgWidth || wmHeight > imgHeight) {
          const scale = Math.min(imgWidth / wmWidth, imgHeight / wmHeight);
          wmWidth = Math.round(wmWidth * scale);
          wmHeight = Math.round(wmHeight * scale);
        }

        const position = watermark.position || 'bottom-right';
        const gravity = getGravity(position);
        const opacity = Math.min(1, Math.max(0, watermark.opacity ?? 0.5));

        // 用 dest-in 把水印自身的 alpha 乘以 opacity，保留透明 PNG 的原有透明区域
        const resized = await wmImage.resize(wmWidth, wmHeight).png().toBuffer();
        const wmBuffer = await sharp(resized)
          .ensureAlpha()
          .composite([{
            input: Buffer.from([255, 255, 255, Math.round(255 * opacity)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in'
          }])
          .png()
          .toBuffer();

        pipeline.composite([{
          input: wmBuffer,
          gravity: gravity
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

// 颜色会直接拼进 SVG 的 <style>，只允许颜色值会用到的字符，防止注入任意 SVG 内容
function safeColor(color) {
  return typeof color === 'string' && /^[#a-zA-Z0-9(),.%s]+$/.test(color) ? color : 'rgba(255,255,255,0.7)';
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function calculateTextPosition(imgWidth, imgHeight, wmWidth, wmHeight, padding, position) {
  const map = {
    'top-left':     { left: padding, top: padding },
    'top':          { left: Math.round((imgWidth - wmWidth) / 2), top: padding },
    'top-right':    { left: Math.round(imgWidth - wmWidth - padding), top: padding },
    'left':         { left: padding, top: Math.round((imgHeight - wmHeight) / 2) },
    'center':       { left: Math.round((imgWidth - wmWidth) / 2), top: Math.round((imgHeight - wmHeight) / 2) },
    'right':        { left: Math.round(imgWidth - wmWidth - padding), top: Math.round((imgHeight - wmHeight) / 2) },
    'bottom-left':  { left: padding, top: Math.round(imgHeight - wmHeight - padding) },
    'bottom':       { left: Math.round((imgWidth - wmWidth) / 2), top: Math.round(imgHeight - wmHeight - padding) },
    'bottom-right': { left: Math.round(imgWidth - wmWidth - padding), top: Math.round(imgHeight - wmHeight - padding) },
  };
  return map[position] || map['bottom-right'];
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
