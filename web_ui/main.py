import json
import os
import shutil
import subprocess
import uuid
import zipfile
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

sys.path.insert(0, str(BASE_DIR.parent / "python-doc-processor" / "strikethrough-remover"))
from strike_remover.remover import remove_strikethrough

sys.path.insert(0, str(BASE_DIR.parent / "python-doc-processor" / "docx-to-markdown"))
from docx_to_markdown.converter import docx_to_markdown

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
        capture_output=True, text=True, encoding="utf-8", cwd=str(BASE_DIR.parent / "js-image-cropper")
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
    watermarkType: str = Form("none"),
    watermarkText: str = Form(""),
    watermarkColor: str = Form("rgba(255,255,255,0.5)"),
    watermarkFit: str = Form("shrink"),
    watermarkImage: UploadFile = File(None),
    watermarkPosition: str = Form("bottom-right"),
    watermarkScale: float = Form(0.2),
    watermarkOpacity: float = Form(0.5),
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

    if watermarkType == "text" and watermarkText:
        options["watermark"] = {"text": watermarkText, "color": watermarkColor, "position": watermarkPosition, "fit": watermarkFit}
    elif watermarkType == "image" and watermarkImage:
        wm_ext = Path(watermarkImage.filename).suffix
        wm_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{wm_ext}"
        with open(wm_path, "wb") as f:
            shutil.copyfileobj(watermarkImage.file, f)
        options["watermark"] = {
            "image": str(wm_path),
            "position": watermarkPosition,
            "scale": watermarkScale,
            "opacity": watermarkOpacity,
        }

    payload = {
        "action": "convert",
        "path": str(input_path),
        "format": format,
        "options": options,
    }

    result = subprocess.run(
        ["node", str(NODE_BRIDGE), json.dumps(payload)],
        capture_output=True, text=True, encoding="utf-8", cwd=str(BASE_DIR.parent / "js-image-cropper")
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
        data["previewUrl"] = f"/api/preview/{dest.name}"
        data["filename"] = dest.name

    input_path.unlink(missing_ok=True)
    return data


def _build_options(
    quality: int,
    flipH: bool,
    flipV: bool,
    ratio: str,
    size: str,
    rotate: str,
    watermarkType: str,
    watermarkText: str,
    watermarkColor: str,
    watermarkFit: str,
    watermarkImage: UploadFile,
    watermarkPosition: str,
    watermarkScale: float,
    watermarkOpacity: float,
    upload_dir: Path,
):
    options = {"quality": quality, "skipExisting": False, "flipH": flipH, "flipV": flipV}
    if ratio:
        options["ratio"] = ratio
    if size:
        options["size"] = size
    if rotate:
        options["angle"] = float(rotate)

    if watermarkType == "text" and watermarkText:
        options["watermark"] = {
            "text": watermarkText,
            "color": watermarkColor,
            "position": watermarkPosition,
            "fit": watermarkFit,
        }
    elif watermarkType == "image" and watermarkImage:
        wm_ext = Path(watermarkImage.filename).suffix
        wm_path = upload_dir / f"{uuid.uuid4().hex}{wm_ext}"
        with open(wm_path, "wb") as f:
            shutil.copyfileobj(watermarkImage.file, f)
        options["watermark"] = {
            "image": str(wm_path),
            "position": watermarkPosition,
            "scale": watermarkScale,
            "opacity": watermarkOpacity,
        }
    return options


def _run_node_convert(input_path: Path, target_format: str, options: dict):
    payload = {
        "action": "convert",
        "path": str(input_path),
        "format": target_format,
        "options": options,
    }
    result = subprocess.run(
        ["node", str(NODE_BRIDGE), json.dumps(payload)],
        capture_output=True, text=True, encoding="utf-8", cwd=str(BASE_DIR.parent / "js-image-cropper")
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"success": False, "error": f"Invalid JSON from node: {result.stdout}, stderr: {result.stderr}", "path": str(input_path)}
    return data


@app.post("/api/image/batch")
async def image_batch(
    files: list[UploadFile] = File(...),
    format: str = Form(...),
    quality: int = Form(85),
    ratio: str = Form(""),
    size: str = Form(""),
    flipH: bool = Form(False),
    flipV: bool = Form(False),
    rotate: str = Form(""),
    watermarkType: str = Form("none"),
    watermarkText: str = Form(""),
    watermarkColor: str = Form("rgba(255,255,255,0.5)"),
    watermarkFit: str = Form("shrink"),
    watermarkImage: UploadFile = File(None),
    watermarkPosition: str = Form("bottom-right"),
    watermarkScale: float = Form(0.2),
    watermarkOpacity: float = Form(0.5),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    batch_id = uuid.uuid4().hex
    batch_upload_dir = UPLOAD_DIR / f"batch_{batch_id}"
    batch_upload_dir.mkdir(exist_ok=True)

    options = _build_options(
        quality, flipH, flipV, ratio, size, rotate,
        watermarkType, watermarkText, watermarkColor, watermarkFit,
        watermarkImage, watermarkPosition, watermarkScale, watermarkOpacity,
        batch_upload_dir,
    )

    results = []
    succeeded = []
    failed = []

    for file in files:
        ext = Path(file.filename).suffix
        input_path = batch_upload_dir / f"{uuid.uuid4().hex}{ext}"
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        data = _run_node_convert(input_path, format, options)

        if data.get("success"):
            output_path = data.get("outputPath")
            if output_path:
                dest = OUTPUT_DIR / Path(output_path).name
                shutil.move(output_path, dest)
                data["downloadUrl"] = f"/api/download/{dest.name}"
                data["previewUrl"] = f"/api/preview/{dest.name}"
                data["filename"] = dest.name
            succeeded.append(data)
        else:
            failed.append({"filename": file.filename, "error": data.get("error", "Unknown error")})

        input_path.unlink(missing_ok=True)

    # 清理水印临时文件
    if watermarkType == "image" and watermarkImage:
        wm_ext = Path(watermarkImage.filename).suffix
        for p in batch_upload_dir.glob(f"*{wm_ext}"):
            if p.name not in [r.get("filename", "") for r in succeeded]:
                p.unlink(missing_ok=True)

    # 打包 ZIP
    zip_filename = f"batch_{batch_id}.zip"
    zip_path = OUTPUT_DIR / zip_filename
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in succeeded:
            file_path = OUTPUT_DIR / item["filename"]
            if file_path.exists():
                zf.write(file_path, item["filename"])

    # 清理临时目录
    shutil.rmtree(batch_upload_dir, ignore_errors=True)

    return {
        "success": True,
        "total": len(files),
        "succeeded": len(succeeded),
        "failed": len(failed),
        "zipUrl": f"/api/download/{zip_filename}",
        "zipFilename": zip_filename,
        "results": succeeded,
        "errors": failed,
    }


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


@app.post("/api/doc/remove-strikethrough")
async def doc_remove_strikethrough(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Only .docx and .doc files are supported")

    if ext == ".doc":
        raise HTTPException(status_code=400, detail=".doc files are not supported yet, please save as .docx")

    input_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        stem = Path(file.filename).stem
        output_filename = f"{stem}_cleaned.docx"
        output_path = OUTPUT_DIR / output_filename
        remove_strikethrough(str(input_path), str(output_path))
    except Exception as exc:
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}")
    finally:
        input_path.unlink(missing_ok=True)

    return {
        "success": True,
        "filename": output_filename,
        "downloadUrl": f"/api/download/{output_filename}",
    }


@app.post("/api/doc/convert-to-markdown")
async def doc_convert_to_markdown(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Only .docx and .doc files are supported")

    if ext == ".doc":
        raise HTTPException(status_code=400, detail=".doc files are not supported yet, please save as .docx")

    input_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        stem = Path(file.filename).stem
        output_filename = f"{stem}.md"
        output_path = OUTPUT_DIR / output_filename
        docx_to_markdown(str(input_path), str(output_path))
    except Exception as exc:
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}")
    finally:
        input_path.unlink(missing_ok=True)

    return {
        "success": True,
        "filename": output_filename,
        "downloadUrl": f"/api/download/{output_filename}",
    }


@app.get("/api/download/{filename}")
async def download(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename)


@app.get("/api/preview/{filename}")
async def preview(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
