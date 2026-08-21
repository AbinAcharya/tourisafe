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
    url = "http://127.0.0.1:8000/"
    _open_browser_later(url, delay=1.0)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
