import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / "python-excel-generator" / ".venv" / "Scripts" / "python.exe"


def find_free_port(start=8000):
    port = start
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
        port += 1


def main():
    if not VENV_PYTHON.exists():
        print("[Error] Virtual environment not found:")
        print(f"  {VENV_PYTHON}")
        print()
        print("Please install dependencies first:")
        print("  cd python-excel-generator")
        print("  uv pip install fastapi uvicorn python-multipart")
        input("\nPress Enter to exit...")
        sys.exit(1)

    port = find_free_port(8000)
    url = f"http://localhost:{port}"

    print("=" * 40)
    print("  My Tools Web UI")
    print(f"  {url}")
    print("=" * 40)
    print()

    time.sleep(0.5)
    webbrowser.open(url)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)

    try:
        subprocess.run(
            [str(VENV_PYTHON), "-m", "uvicorn", "web_ui.main:app", "--host", "0.0.0.0", "--port", str(port)],
            cwd=str(ROOT),
            env=env,
        )
    except KeyboardInterrupt:
        pass

    print()
    input("Server stopped. Press Enter to exit...")


if __name__ == "__main__":
    main()
