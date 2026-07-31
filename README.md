# my-tools

Personal collection of handy tools.

## Quick Start (Web UI)

Unified web interface for all tools — no command line required.

### Prerequisites

- Python 3.10+ with `uv`
- Node.js 18+

### Install dependencies

```bash
cd python-excel-generator
uv pip install fastapi uvicorn python-multipart python-docx

cd ../js-image-cropper
npm install

cd ../python-doc-processor/strikethrough-remover
pip install -e .
```

### Start the server

**Windows:** Double-click `run.bat` or run in terminal:

```bash
run.bat
```

**Manual start (cross-platform):**

```bash
PYTHONPATH="$(pwd)" python-excel-generator/.venv/Scripts/python -m uvicorn web_ui.main:app --host 0.0.0.0 --port 8000
```

Then open `http://localhost:8000` in your browser.

---

## Tools (CLI)

### 1. python-excel-generator
Excel Test Data Generator (Python)

Quickly generate Excel files with random data, custom headers, and multiple data types.

```bash
cd python-excel-generator
uv sync
uv run python -m src.main generate test.xlsx --count 100
```

See [python-excel-generator/README.md](python-excel-generator/README.md) for details.

---

### 2. js-image-cropper
Node.js Image Format Converter

Batch convert images between formats with configurable quality.

```bash
cd js-image-cropper
npm install
npm start
```

See [js-image-cropper/README.md](js-image-cropper/README.md) for details.

---

### 3. python-doc-processor

Word document utilities (starting with strikethrough removal).

```bash
cd python-doc-processor/strikethrough-remover
python -m strike_remover.main input.docx output.docx
```

See [python-doc-processor/strikethrough-remover/README.md](python-doc-processor/strikethrough-remover/README.md) for details.
