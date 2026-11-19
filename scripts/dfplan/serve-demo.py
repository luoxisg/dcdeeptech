"""Serve only the public DFplan directory, never the repository or backend."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2] / "dfplan"


class DemoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ("/", "/dfplan"):
            self.send_response(302)
            self.send_header("Location", "/dfplan/?demo=1")
            self.end_headers()
        elif not path.startswith("/dfplan/"):
            self.send_error(404)
        else:
            self.path = self.path[len("/dfplan"):]
            super().do_GET()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8086)
    args = parser.parse_args()
    print(f"DFplan demo: http://127.0.0.1:{args.port}/dfplan/?demo=1", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), DemoHandler).serve_forever()
