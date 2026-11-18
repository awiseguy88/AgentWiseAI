#!/usr/bin/env python3
"""
Generates deterministic synthetic fixtures for TinySqueeze tests and demos.

Fixtures:
  fixtures/sample-photo.jpg   — synthetic 800x600 JPEG (gradient + noise, deterministic)
  fixtures/sample-graphic.png — synthetic 400x300 PNG with flat colors + transparency
  fixtures/sample-small.jpg   — small 200x150 JPEG for batch tests
  fixtures/not-an-image.txt   — plain text (unsupported type)
  fixtures/corrupt.png        — intentionally truncated PNG bytes
  fixtures/expected-sizes.json — reference metadata

Requires Pillow (PIL). Fixtures are committed to the repo, so CI does not run this.
"""
import json
import os
import struct
import zlib
from datetime import datetime, timezone
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "..", "fixtures")

# ---------------- PRNG (deterministic) ----------------
class LCG:
    def __init__(self, seed=0xC0FFEE):
        self.state = seed & 0xFFFFFFFF
    def rand(self):
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return (self.state >> 8) / 0xFFFFFF

rnd = LCG().rand

# ---------------- content ----------------
def gray_photo(width, height):
    img = Image.new("L", (width, height))
    px = img.load()
    r = LCG(0xC0FFEE)
    for y in range(height):
        for x in range(width):
            v = int(100 + 100 * _sin(x / 50) * _cos(y / 40) + 40 * r.rand())
            px[x, y] = max(0, min(255, v))
    return img

def _sin(v):
    import math
    return math.sin(v)
def _cos(v):
    import math
    return math.cos(v)

def rgba_graphic(width, height):
    img = Image.new("RGBA", (width, height))
    px = img.load()
    for y in range(height):
        for x in range(width):
            if x < width / 3:
                px[x, y] = (0x1E, 0x3A, 0x8A, 0xFF)  # blue
            elif x < (2 * width) / 3:
                px[x, y] = (0x7C, 0x3A, 0xED, 0xFF)  # purple
            else:
                a = 0xFF if y < height / 2 else 0x80  # pink, half transparent bottom
                px[x, y] = (0xDB, 0x27, 0x77, a)
    return img

def make_corrupt_png():
    # Valid PNG header + IHDR + truncated IDAT (intentionally invalid)
    width = height = 10
    raw = b"".join(b"\x00" + bytes(40) for _ in range(height))  # RGBA rows
    idat = zlib.compress(raw)
    def chunk(ctype, data):
        return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    return png[: len(png) - 40]  # truncate tail

def main():
    os.makedirs(FIXTURES, exist_ok=True)

    # sample-photo.jpg — 800x600
    gray_photo(800, 600).save(os.path.join(FIXTURES, "sample-photo.jpg"), "JPEG", quality=82)
    photo_size = os.path.getsize(os.path.join(FIXTURES, "sample-photo.jpg"))

    # sample-graphic.png — 400x300 with transparency
    rgba_graphic(400, 300).save(os.path.join(FIXTURES, "sample-graphic.png"), "PNG")
    graphic_size = os.path.getsize(os.path.join(FIXTURES, "sample-graphic.png"))

    # sample-small.jpg — 200x150
    gray_photo(200, 150).save(os.path.join(FIXTURES, "sample-small.jpg"), "JPEG", quality=85)
    small_size = os.path.getsize(os.path.join(FIXTURES, "sample-small.jpg"))

    # not-an-image.txt
    with open(os.path.join(FIXTURES, "not-an-image.txt"), "w") as f:
        f.write("this is not an image file")

    # corrupt.png
    with open(os.path.join(FIXTURES, "corrupt.png"), "wb") as f:
        f.write(make_corrupt_png())
    corrupt_size = os.path.getsize(os.path.join(FIXTURES, "corrupt.png"))

    expected = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "note": "Sizes are reference metadata. Compressed sizes vary by browser/encoder; assert structural correctness, not exact bytes.",
        "fixtures": [
            {"name": "sample-photo.jpg", "type": "image/jpeg", "width": 800, "height": 600, "bytes": photo_size},
            {"name": "sample-graphic.png", "type": "image/png", "width": 400, "height": 300, "bytes": graphic_size},
            {"name": "sample-small.jpg", "type": "image/jpeg", "width": 200, "height": 150, "bytes": small_size},
            {"name": "not-an-image.txt", "type": "text/plain", "width": None, "height": None, "bytes": len("this is not an image file")},
            {"name": "corrupt.png", "type": "image/png", "width": None, "height": None, "bytes": corrupt_size, "corrupt": True},
        ],
    }
    with open(os.path.join(FIXTURES, "expected-sizes.json"), "w") as f:
        json.dump(expected, f, indent=2)
        f.write("\n")

    print("fixtures written to", os.path.abspath(FIXTURES))
    print(json.dumps(expected["fixtures"], indent=2))

if __name__ == "__main__":
    main()