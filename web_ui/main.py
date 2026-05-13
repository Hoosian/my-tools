import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="My Tools Web UI")

BASE_DIR = Path(__file__).resolve().parent

import sys
sys.path.insert(0, str(BASE_DIR.parent / "python-excel-generator"))
from src.generator import generate_excel
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
NODE_BRIDGE = BASE_DIR.parent / "js-image-cropper" / "api-bridge.js"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse(content="<h1>index.html not found</h1>", status_code=500)
    return HTMLResponse(content=index_path.read_text(encoding="utf-8"))


@app.get("/api/image/formats")
async def image_formats():
    result = subprocess.run(
        ["node", str(NODE_BRIDGE), json.dumps({"action": "formats"})],
        capture_output=True, text=True, cwd=str(BASE_DIR.parent / "js-image-cropper")
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Node error: {result.stderr}")
    return json.loads(result.stdout)


@app.post("/api/image/convert")
async def image_convert(
    file: UploadFile = File(...),
    format: str = Form(...),
    quality: int = Form(85),
    ratio: str = Form(""),
    size: str = Form(""),
    flipH: bool = Form(False),
    flipV: bool = Form(False),
    rotate: str = Form(""),
):
    ext = Path(file.filename).suffix
    input_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    options = {"quality": quality, "skipExisting": False, "flipH": flipH, "flipV": flipV}
    if ratio:
        options["ratio"] = ratio
    if size:
        options["size"] = size
    if rotate:
        options["angle"] = float(rotate)

    payload = {
        "action": "convert",
        "path": str(input_path),
        "format": format,
        "options": options,
    }

    result = subprocess.run(
        ["node", str(NODE_BRIDGE), json.dumps(payload)],
        capture_output=True, text=True, cwd=str(BASE_DIR.parent / "js-image-cropper")
    )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Invalid JSON from node: {result.stdout}, stderr: {result.stderr}")

    if not data.get("success"):
        raise HTTPException(status_code=400, detail=data.get("error", "Unknown error"))

    output_path = data.get("outputPath")
    if output_path:
        dest = OUTPUT_DIR / Path(output_path).name
        shutil.move(output_path, dest)
        data["downloadUrl"] = f"/api/download/{dest.name}"
        data["filename"] = dest.name

    input_path.unlink(missing_ok=True)
    return data


@app.post("/api/excel/generate")
async def excel_generate(body: dict):
    filename = body.get("filename", "test.xlsx")
    count = body.get("count", 10)
    headers = body.get("headers", ["姓名", "年龄", "邮箱", "电话", "城市"])
    schema_raw = body.get("schema", {})

    if not schema_raw:
        schema_raw = {
            "姓名": "name",
            "年龄": "age",
            "邮箱": "email",
            "电话": "phone",
            "城市": "city",
        }

    output_path = OUTPUT_DIR / filename
    generate_excel(str(output_path), count, headers, schema_raw)

    return {
        "success": True,
        "filename": filename,
        "downloadUrl": f"/api/download/{filename}",
    }


@app.get("/api/download/{filename}")
async def download(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
