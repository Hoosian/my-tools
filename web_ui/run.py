import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]

def main():
    port = find_free_port()
    base_dir = Path(__file__).resolve().parent
    os.environ["PYTHONPATH"] = str(base_dir.parent)
    os.environ["PORT"] = str(port)

    print(f"Starting server on http://127.0.0.1:{port}")
    webbrowser.open(f"http://127.0.0.1:{port}")

    subprocess.run([
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", str(port),
        "--app-dir", str(base_dir)
    ])

if __name__ == "__main__":
    main()
