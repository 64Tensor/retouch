---
"@64tensor/retouch": patch
---

Crop's aspect presets (Square, 16:9 and the rest) are exact. They took the photo's shape from its size on screen, which is rounded to whole pixels, so at some window sizes a square crop saved a pixel wider than tall, such as 1001 × 1000.
