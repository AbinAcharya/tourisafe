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

    preferred = [8001, 8000, 8002, 8003, 8004]

    def _port_is_free(p: int) -> bool:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(('0.0.0.0', p))
            s.close()
            return True
        except Exception:
            try:
                s.close()
            except Exception:
                pass
            return False

    port = None
    for p in preferred:
        if _port_is_free(p):
            port = p
            break
    if port is None:
        # ask OS for an available port
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('0.0.0.0', 0))
        port = s.getsockname()[1]
        s.close()

    url = f"http://127.0.0.1:{port}/"
    print(f"Starting server on port {port}")
    _open_browser_later(url, delay=1.0)
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
