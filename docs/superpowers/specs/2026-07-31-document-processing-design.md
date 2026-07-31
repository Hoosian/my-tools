# 文档处理：删除 Word 删除线内容

## 背景

仓库 `my-tools` 目前已有两类工具：

- `python-excel-generator/` — Python Excel 测试数据生成
- `js-image-cropper/` — Node.js 图片格式转换
- `web_ui/` — 统一的 Web 界面，把上述工具串起来

本次新增一个文档处理工具：上传 Word 文档（`.docx`），删除其中所有带**删除线格式**的文字，输出新的 Word 文档。

## 目标

1. 新建 `python-doc-processor/` 目录作为文档处理总目录。
2. 在该目录下实现第一个功能 `strikethrough-remover/`：删除 `.docx` 中被删除线标识的内容。
3. 集成到 `web_ui`，新增“文档处理” tab。
4. 保留现有代码风格，复用 Python 技术栈。

## 需求

- 输入：`.docx` 文件（本次先支持 `.docx`，`.doc` 后续扩展）。
- 输出：新的 `.docx` 文件。
- 处理范围：正文段落、表格单元格、页眉、页脚中的 runs。
- 删除规则：删除所有带有 `<w:strike/>` 或 `<w:dstrike/>` 的 run。
- 空格清理：删除后合并段落中相邻的多个空格为一个。
- 表格清理：删除处理后整行都为空的表格行。

## 目录结构

```text
python-doc-processor/               # 文档处理总目录
├── strikethrough-remover/          # 删除线清理功能
│   ├── strike_remover/             # Python 包
│   │   ├── __init__.py
│   │   ├── remover.py              # 核心删除逻辑
│   │   └── main.py                 # CLI 入口
│   ├── tests/
│   │   ├── fixtures/
│   │   │   ├── with_strike.docx
│   │   │   └── without_strike.docx
│   │   └── test_remover.py
│   ├── README.md
│   └── pyproject.toml              # 依赖 python-docx
└── ...                             # 后续其他文档功能
```

## 核心模块设计

### `remover.py`

函数签名：

```python
def remove_strikethrough(input_path: str, output_path: str) -> None:
    ...
```

实现要点：

1. 使用 `python-docx` 打开 `input_path`。
2. 遍历所有需要检查的位置：
   - `document.paragraphs`
   - `document.tables`（递归单元格中的段落）
   - `section.header` / `section.footer` 中的段落和表格
3. 对每个 paragraph 的 runs：
   - 读取 `run._r.get_or_add_rPr()`。
   - 如果其中包含 `w:strike` 或 `w:dstrike` 元素，则移除该 run 的 XML 节点。
4. 保存到 `output_path`。

### `main.py`

提供 CLI：

```bash
python -m strike_remover.main input.docx output.docx
```

## Web UI 集成

### 后端（`web_ui/main.py`）

新增路由：

```python
@app.post("/api/doc/remove-strikethrough")
async def doc_remove_strikethrough(file: UploadFile = File(...)):
    # 1. 校验扩展名 .docx/.doc
    # 2. 保存上传文件到 uploads/
    # 3. 调用 remover.remove_strikethrough()
    # 4. 将结果移动到 outputs/
    # 5. 返回 downloadUrl
```

通过 `sys.path.insert` 引入 `python-doc-processor/strikethrough-remover`，并 `from strike_remover.remover import remove_strikethrough`。

### 前端（`web_ui/static/index.html`）

- 新增 tab：`<button class="tab" onclick="switchTab('doc')">📝 文档处理</button>`
- 新增 panel `#panel-doc`：
  - 文件上传，accept=".docx,.doc"
  - “清理删除线”按钮
  - 结果区域显示下载链接

## 错误处理

- 文件类型非法：返回 `400`，提示只支持 `.docx`/`.doc`。
- `.doc` 文件：本次直接拒绝（后续可通过 LibreOffice 转换扩展）。
- 处理异常：返回 `500`，附带错误信息，并清理临时上传文件。
- 输出文件名冲突：覆盖或加时间戳，采用现有 `outputs/` 目录策略。

## 测试

- 单元测试：使用 `python-docx` 构造含删除线 run 的 docx，调用 `remove_strikethrough` 后断言：
  - 删除线文字已不存在。
  - 普通文字保留。
  - 段落/表格结构未破坏。
- 手动测试：通过 Web UI 上传文件，下载输出并用 Word/WPS 打开检查。

## 依赖

- `python-docx`

## 后续可扩展

- 支持 `.doc` 输入：通过 LibreOffice headless 转换为 `.docx` 后处理。
- 支持删除 Word 修订模式中的“删除”标记。
- 在 `python-doc-processor/` 下新增其他文档处理功能（PDF 合并、Word 模板填充等）。
