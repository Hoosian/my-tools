# my-tools

个人常用工具集合。

## 工具列表

### 1. js-excel-generator
Excel 测试数据生成工具（Python）

快速生成带随机数据的 Excel 文件，支持自定义表头和多种数据类型。

```bash
cd js-excel-generator
uv sync
uv run python -m src.main generate test.xlsx --count 100
```

详细说明见 [js-excel-generator/README.md](js-excel-generator/README.md)

---

### 2. python-image-cropper
Node.js 图片格式转换工具

支持多种图片格式的批量转换，质量可配置。

```bash
cd python-image-cropper
npm install
npm start
```

详细说明见 [python-image-cropper/README.md](python-image-cropper/README.md)
