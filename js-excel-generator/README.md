# imageTools - 图片格式转换工具

Node.js 图片批量格式转换工具，支持多种格式，质量可配置。

## 功能特性

- 单文件转换
- 目录批量转换
- 递归处理子目录
- 质量参数可配置
- 交互式菜单
- 冲突文件自动跳过

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

## 输出规则

- 输出文件与原文件在同一目录
- 文件命名格式：`原文件名_<目标格式>.<原扩展名>`
- 例如：`photo.png` → `photo_jpg.png`
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
