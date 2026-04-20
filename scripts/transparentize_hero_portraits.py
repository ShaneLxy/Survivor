from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path(r"E:\AIGame\resource\hero")
DST_DIR = ROOT / "assets" / "media" / "heroes"

TARGET_FILES = [
    "Yajin.jpg",
    "Galaxy.png",
    "Gray.png",
    "Elise.jpg",
    "PurpleFox.png",
    "Hoshino.png",
    "LingYue.png",
    "Vera.png",
    "King.png",
    "Clockwork.png",
]

PORTRAIT_UPDATES = {
    "hero_010": "assets/media/heroes/Yajin.png",
    "hero_011": "assets/media/heroes/Galaxy.png",
    "hero_012": "assets/media/heroes/Gray.png",
    "hero_013": "assets/media/heroes/Elise.png",
    "hero_014": "assets/media/heroes/PurpleFox.png",
    "hero_015": "assets/media/heroes/Hoshino.png",
    "hero_016": "assets/media/heroes/LingYue.png",
    "hero_017": "assets/media/heroes/Vera.png",
    "hero_018": "assets/media/heroes/King.png",
    "hero_019": "assets/media/heroes/Clockwork.png",
}


def sample_points(width: int, height: int) -> list[tuple[int, int]]:
    offsets = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    inset = max(4, min(width, height) // 40)
    offsets.extend(
        [
            (inset, inset),
            (width - 1 - inset, inset),
            (inset, height - 1 - inset),
            (width - 1 - inset, height - 1 - inset),
        ]
    )
    return offsets


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def connected_background_mask(image: Image.Image, threshold: int = 42) -> list[bool]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    seeds = sample_points(width, height)
    reference_colors = [pixels[x, y][:3] for x, y in seeds]

    mask = [False] * (width * height)
    queue: deque[tuple[int, int]] = deque()

    for x, y in seeds:
        index = y * width + x
        if mask[index]:
            continue
        mask[index] = True
        queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            index = ny * width + nx
            if mask[index]:
                continue
            color = pixels[nx, ny][:3]
            if min(color_distance(color, ref) for ref in reference_colors) <= threshold:
                mask[index] = True
                queue.append((nx, ny))

    return mask


def soften_edges(image: Image.Image, mask: list[bool], edge_threshold: int = 24) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if mask[index]:
                pixels[x, y] = (0, 0, 0, 0)
                continue

            if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                continue

            near_background = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                nindex = ny * width + nx
                if mask[nindex]:
                    near_background = True
                    break
            if not near_background:
                continue

            color = pixels[x, y][:3]
            neighbor_colors: list[tuple[int, int, int]] = []
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if mask[ny * width + nx]:
                    continue
                neighbor_colors.append(pixels[nx, ny][:3])
            if not neighbor_colors:
                continue

            diff = min(color_distance(color, neighbor) for neighbor in neighbor_colors)
            if diff <= edge_threshold:
                alpha = max(96, min(255, 96 + diff * 6))
                pixels[x, y] = (*color, alpha)

    return rgba


def process_image(source_name: str) -> Path:
    source_path = SRC_DIR / source_name
    target_name = f"{Path(source_name).stem}.png"
    target_path = DST_DIR / target_name

    image = Image.open(source_path)
    mask = connected_background_mask(image)
    result = soften_edges(image, mask)
    result.save(target_path)
    return target_path


def update_catalog_portraits() -> None:
    catalog_path = ROOT / "data" / "unit-catalog.json"
    text = catalog_path.read_text(encoding="utf-8")
    for hero_id, portrait in PORTRAIT_UPDATES.items():
        marker = f'"id": "{hero_id}"'
        hero_index = text.find(marker)
        if hero_index == -1:
            continue
        portrait_key = '"portrait": "'
        portrait_index = text.find(portrait_key, hero_index)
        if portrait_index == -1:
            continue
        value_start = portrait_index + len(portrait_key)
        value_end = text.find('"', value_start)
        if value_end == -1:
            continue
        text = text[:value_start] + portrait + text[value_end:]
    catalog_path.write_text(text, encoding="utf-8")


def main() -> None:
    for name in TARGET_FILES:
        process_image(name)
    update_catalog_portraits()


if __name__ == "__main__":
    main()
