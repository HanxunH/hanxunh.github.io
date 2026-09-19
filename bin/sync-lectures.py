#!/usr/bin/env python3
"""Sync unlisted lectures, then commit and push the generated assets to publish.

Usage: python3 bin/sync-lectures.py [presentation-folder]
The destination is fully managed by this script; edit the source folder instead.
Only Lectures 15–18 and web resources are published, not PDFs or other HTML files.
"""

import argparse
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
DESTINATION = ROOT / "teaching/2026/comp90073"
DEFAULT_SOURCE = Path.home() / "Desktop/Research/UniMelb/Teaching/COMP90073_2026/presentation"
LECTURES = {f"lecture{number}.html": f"lectures{number}.html" for number in range(15, 19)}
RESOURCE_EXTENSIONS = {
    ".css", ".js", ".mjs", ".json", ".wasm",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf",
    ".mp4", ".webm", ".mp3", ".ogg", ".wav", ".vtt",
}
PRIVACY_META = (
    '\n  <meta name="robots" content="noindex, nofollow, noarchive">'
    '\n  <meta name="referrer" content="no-referrer">'
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.is_dir():
        parser.error(f"Source directory does not exist: {source}")
    if source == DESTINATION or source in DESTINATION.parents or DESTINATION in source.parents:
        parser.error("Source and managed destination must not overlap")

    # Prepare every file before changing the published copy. Missing lectures abort sync.
    files = {}
    for name, published_name in LECTURES.items():
        path = source / name
        if not path.is_file() or path.is_symlink():
            parser.error(f"Missing lecture or unsupported symlink: {path}")
        html, count = re.subn(
            r"<head\b[^>]*>", lambda match: match.group(0) + PRIVACY_META,
            path.read_text(encoding="utf-8"), count=1, flags=re.IGNORECASE,
        )
        if count != 1:
            parser.error(f"Lecture has no HTML head: {path}")
        files[Path(published_name)] = html.encode("utf-8")

    # Copy shared resources too: some images and scripts are loaded dynamically.
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.is_symlink():
            parser.error(f"Symlinks are not supported: {path}")
        if path.is_file() and path.suffix.lower() in RESOURCE_EXTENSIONS:
            files[relative] = path.read_bytes()

    updated = removed = 0
    for relative, content in files.items():
        target = DESTINATION / relative
        if target.is_file() and target.read_bytes() == content:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        updated += 1

    # This dedicated directory contains only generated lecture files.
    for target in sorted(DESTINATION.rglob("*"), reverse=True):
        if target.is_file() and target.relative_to(DESTINATION) not in files:
            target.unlink()
            removed += 1
        elif target.is_dir() and not any(target.iterdir()):
            target.rmdir()

    print(f"Synced {len(files)} files: {updated} updated, {removed} removed.")
    print("Commit and push the generated assets to publish; URLs stay unchanged:")
    for name in LECTURES.values():
        print(f"https://hanxunh.github.io/{DESTINATION.relative_to(ROOT).as_posix()}/{name}")


if __name__ == "__main__":
    main()
