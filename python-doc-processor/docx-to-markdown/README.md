# Word 转 Markdown 工具

将 Word 文档（`.docx`）转换为 Markdown 文本。

## 安装

```bash
cd python-doc-processor/docx-to-markdown
pip install -e .
```

## 命令行用法

```bash
python -m docx_to_markdown.main input.docx output.md
```

## Web UI

仓库根目录的 `web_ui` 已集成该功能，启动后可在“文档处理” tab 中选择“转 Markdown”使用。

## 支持范围

- 普通段落
- 标题（Heading 1-9）
- 无序列表
- 有序列表
- 粗体 / 斜体
- 表格

## 暂不支持

- 图片提取
- 页眉 / 页脚
- 文本框 / 形状
- 单元格内样式
- `.doc` 老格式
