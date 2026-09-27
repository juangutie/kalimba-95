#!/usr/bin/env python3
"""Local dev server for Kalimba 95.

Same as `python3 -m http.server`, plus HTTP Range support. Browsers need Range
requests to seek in long audio files (the media player scrub bar); the stock
http.server always sends the whole file, so seeking breaks on bigger tracks.
Real static hosts (GitHub Pages, Netlify, ...) already support Range.

Usage: python3 serve.py [port]   (default 8095, binds to 127.0.0.1 only)
"""
import http.server
import os
import re
import sys

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        range_header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not range_header or os.path.isdir(path):
            return super().send_head()

        match = RANGE_RE.match(range_header.strip())
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = os.fstat(f.fileno()).st_size
        start_s, end_s = match.groups() if match else ("", "")
        if not match or (not start_s and not end_s):
            f.close()
            return super().send_head()
        if start_s:
            start = int(start_s)
            end = min(int(end_s), size - 1) if end_s else size - 1
        else:  # suffix range: last N bytes
            start = max(0, size - int(end_s))
            end = size - 1
        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_range_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        self._range_left = None
        while left > 0:
            chunk = source.read(min(64 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def end_headers(self):
        # Advertise Range support on normal responses too, so browsers try it.
        if not any(h.lower().startswith(b"accept-ranges") for h in getattr(self, "_headers_buffer", [])):
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8095
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), RangeRequestHandler)
    print(f"Kalimba 95 at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
