"""Entrypoint so you can run: python main.py
Drives uvicorn programmatically to serve the `app.main:app` FastAPI app.
This file will also open the default browser to the dashboard URL after the server starts.
"""
import threading
import time
import webbrowser
import uvicorn


def _open_browser_later(url: str, delay: float = 1.0):
    def _target():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    t = threading.Thread(target=_target, daemon=True)
    t.start()


if __name__ == "__main__":
    import socket

    # Enforce fixed port 8000 as requested. The process will fail to start if the port is in use.
    port = 8000
    url = f"http://127.0.0.1:{port}/"
    print(f"Starting server on fixed port {port}")
    _open_browser_later(url, delay=1.0)
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
