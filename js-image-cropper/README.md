# imageTools - 图片格式转换工具

Node.js 图片批量格式转换工具，支持多种格式，质量可配置。

## 功能特性

- 单文件转换
- 目录批量转换
- 递归处理子目录
- 质量参数可配置
- 交互式菜单
- 冲突文件自动跳过
- **图片变换**：支持水平翻转、垂直翻转、旋转
- **水印功能**：支持文字水印和图片水印

## 支持格式

**输入**: jpeg, jpg, png, webp, gif, tiff, bmp, avif, heif, svg

**输出**: jpeg, jpg, png, webp, tiff, gif, avif, heif

## 安装

```bash
npm install
```

## 使用方法

### 交互式菜单

直接运行（无参数时自动进入交互式菜单）：

```bash
npm start
```

### 命令行模式

#### 单文件转换

```bash
npm start -- convert <文件路径> -f <目标格式> [-q <质量1-100>]
```

示例：

```bash
npm start -- convert photo.png -f jpg -q 90
npm start -- convert image.webp -f png
```

#### 目录批量转换

```bash
npm start -- convert <目录路径> -f <目标格式> [-q <质量1-100>] [-r]
```

示例：

```bash
# 转换目录中所有图片
npm start -- convert ./images -f webp -q 80

# 递归转换（包括子目录）
npm start -- convert ./photos -f png -r
```

#### 图片变换

```bash
# 水平翻转（左右镜像）
npm start -- convert photo.png -f png --flip-h

# 垂直翻转（上下镜像）
npm start -- convert photo.png -f png --flip-v

# 旋转 90 度（顺时针）
npm start -- convert photo.png -f png --rotate 90

# 旋转 -45 度（逆时针）
npm start -- convert photo.png -f png --rotate -45

# 旋转 180 度
npm start -- convert photo.png -f png --rotate 180

# 组合使用：翻转 + 旋转 + 缩放
npm start -- convert photo.png -f webp --flip-h --rotate 90 --size 800x600
```

#### 添加水印

```bash
# 添加文字水印（默认白色，位于图片右下角）
npm start -- convert photo.png -f png --watermark-text "Hello World"

# 添加文字水印（自定义颜色）
npm start -- convert photo.png -f png --watermark-text "Copyright" --watermark-color "rgba(0,0,0,0.8)"

# 添加文字水印（自定义颜色和位置）
npm start -- convert photo.png -f png --watermark-text "Copyright" --watermark-color "rgba(0,0,0,0.3)" --watermark-position bottom-right

# 添加图片水印
npm start -- convert photo.png -f png --watermark-image ./logo.png

# 添加图片水印（自定义缩放和位置）
npm start -- convert photo.png -f png --watermark-image ./logo.png --watermark-scale 0.15 --watermark-position top-left

# 组合使用：水印 + 格式转换 + 质量调整
npm start -- convert photo.png -f webp -q 90 --watermark-text "My Site" --watermark-position bottom-right
```

#### 查看支持格式

```bash
npm start -- formats
```

#### 预览输出文件名

```bash
npm start -- preview <文件路径> <目标格式>
```

示例：

```bash
npm start -- preview photo.png jpg
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-f, --format` | 目标格式 | 必需 |
| `-q, --quality` | 图片质量 (1-100) | 85 |
| `-r, --recursive` | 递归处理子目录 | false |
| `--ratio` | 裁剪比例 (如 3:4, 16:9, 1:1) | - |
| `--size` | 缩放尺寸 (如 800x600) | - |
| `--flip-h` | 水平翻转（左右镜像） | false |
| `--flip-v` | 垂直翻转（上下镜像） | false |
| `--rotate` | 旋转角度 (-360 ~ 360) | - |
| `--watermark-text` | 文字水印内容 | - |
| `--watermark-image` | 图片水印路径 (PNG) | - |
| `--watermark-position` | 水印位置 | bottom-right |
| `--watermark-scale` | 图片水印相对尺寸 (0.0-1.0) | 0.2 |
| `--watermark-opacity` | 水印透明度 (0.0-1.0) | 0.5 |
| `--watermark-color` | 文字水印颜色 (rgba 或 hex) | rgba(255,255,255,0.7) |
| `--watermark-color` | 文字水印颜色 | rgba(255,255,255,0.5) |

**水印位置可选值**: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`

## 输出规则

- 输出文件与原文件在同一目录
- 文件命名格式：`原文件名_<目标格式>[_变换参数].<扩展名>`
- 例如：`photo.png` → `photo_jpg.png`
- 例如：`photo.png` → `photo_jpg_flipH_r90.png`（水平翻转 + 旋转90度）
- 变换参数说明：`flipH`=水平翻转、`flipV`=垂直翻转、`r`/`rn`=旋转（n为负数）
- 若目标文件已存在，自动跳过

## 全局安装（可选）

```bash
npm link
```

之后可全局使用：

```bash
imageTools convert photo.png -f jpg
imageTools formats
```

## 项目结构

```
imageTools/
├── package.json
└── src/
    ├── converter.js   # 转换核心逻辑
    └── index.js       # CLI入口
```
