#!/usr/bin/env python3
"""Sync unlisted lectures, then commit and push the generated assets to publish.

Usage: python3 bin/sync-lectures.py [presentation-folder]
The destination is fully managed by this script; edit the source folder instead.
Only Lectures 15–18 and web resources are published, not PDFs or other HTML files.
Speaker notes and the notes plugin are removed only from the published copies.
"""

import argparse
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlsplit


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


class PublicLecture(HTMLParser):
    """Remove note nodes and attributes without rewriting slide markup."""

    ATTRIBUTE = re.compile(r"""\s+([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?""")

    def __init__(self, html, presentation_url):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.presentation_url = presentation_url
        self.line_offsets = [0] + [match.end() for match in re.finditer("\n", html)]
        self.edits = []
        self.hidden_tag = None
        self.hidden_depth = 0
        self.hidden_start = 0

    def source_position(self):
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if self.hidden_tag:
            if tag == self.hidden_tag:
                self.hidden_depth += 1
            return
        attributes = dict(attrs)
        script_path = urlsplit(attributes.get("src") or "").path
        if (tag == "aside" and "notes" in (attributes.get("class") or "").split()) or (
            tag == "script" and "/plugin/notes/" in script_path
        ):
            self.hidden_tag = tag
            self.hidden_depth = 1
            self.hidden_start = self.source_position()
            return
        for match in self.ATTRIBUTE.finditer(self.get_starttag_text()):
            name = match.group(1).lower()
            if name == "data-notes":
                replacement = ""
            elif name == "src" and tag == "script" and script_path == "presentation.js":
                replacement = f' src="{self.presentation_url}"'
            else:
                continue
            start = self.source_position()
            self.edits.append((start + match.start(), start + match.end(), replacement))

    def handle_endtag(self, tag):
        if tag == self.hidden_tag:
            self.hidden_depth -= 1
            if self.hidden_depth == 0:
                end = self.html.index(">", self.source_position()) + 1
                self.edits.append((self.hidden_start, end, ""))
                self.hidden_tag = None

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def render(self):
        self.feed(self.html)
        self.close()
        if self.hidden_tag:
            raise ValueError("Unclosed speaker-note element")
        parts = []
        end = 0
        for start, stop, replacement in sorted(self.edits):
            parts.extend((self.html[end:start], replacement))
            end = stop
        parts.append(self.html[end:])
        return "".join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.is_dir():
        parser.error(f"Source directory does not exist: {source}")
    if source == DESTINATION or source in DESTINATION.parents or DESTINATION in source.parents:
        parser.error("Source and managed destination must not overlap")

    files = {}
    # Copy shared resources too: some images and scripts are loaded dynamically.
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.is_symlink():
            parser.error(f"Symlinks are not supported: {path}")
        if path.is_file() and path.suffix.lower() in RESOURCE_EXTENSIONS:
            files[relative] = path.read_bytes()

    script_path = Path("presentation.js")
    if script_path not in files:
        parser.error("Missing presentation.js")
    public_script, count = re.subn(
        r"plugins:\s*\[\s*RevealNotes\s*\]", "plugins: []",
        files[script_path].decode("utf-8"),
    )
    if count != 1:
        parser.error("Expected one RevealNotes plugin registration in presentation.js")
    files[script_path] = public_script.encode("utf-8")
    presentation_url = f"presentation.js?v={sha256(files[script_path]).hexdigest()[:16]}"

    # Prepare every file before changing the published copy. Missing lectures abort sync.
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
        try:
            html = PublicLecture(html, presentation_url).render()
        except ValueError as error:
            parser.error(f"{path}: {error}")
        files[Path(published_name)] = html.encode("utf-8")


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
