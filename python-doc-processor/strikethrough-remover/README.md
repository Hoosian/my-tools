# 删除线内容清理工具

删除 Word 文档（`.docx`）中所有带删除线格式的文字，输出新的文档。

## 安装

```bash
cd python-doc-processor/strikethrough-remover
pip install -e .
```

## 命令行用法

```bash
python -m strike_remover.main input.docx output.docx
```

## Web UI

仓库根目录的 `web_ui` 已集成该功能，启动后可在“文档处理” tab 中使用。

## 说明

- 只处理直接带有删除线格式（`w:strike` / `w:dstrike`）的 run。
- 会自动遍历正文、表格、页眉、页脚。
- 暂不支持 `.doc` 老格式（后续可通过 LibreOffice 转换扩展）。
