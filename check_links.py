# -*- coding: utf-8 -*-
"""Проверка внутренних ссылок и изображений сайта."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent
pages = sorted(root.glob("*.html"))
broken = []
checked = 0

for page in pages:
    text = page.read_text(encoding="utf-8")
    for link in re.findall(r'(?:href|src)="([^"]+)"', text):
        if link.startswith(("http://", "https://", "mailto:", "#", "data:")):
            continue
        target = root / link.split("#")[0]
        checked += 1
        if not target.exists():
            broken.append((page.name, link))

print("HTML-страниц:", len(pages))
print("Проверено внутренних ссылок:", checked)
print("Битых ссылок:", len(broken))
for item in broken:
    print("  ", item[0], "->", item[1])
