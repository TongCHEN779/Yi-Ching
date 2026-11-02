"""开发用静态服务器：禁用缓存，改完文件刷新即生效。用法：python3 tools/serve.py [端口]"""
import functools, http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCache, directory=ROOT)
    print(f"http://localhost:{port}/")
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
