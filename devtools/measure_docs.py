#!/usr/bin/env python3
"""Measure repository facts used by the graphical documentation pass.

The script reads only tracked source files and the checked-in tool entrypoints.
It intentionally ignores untracked project exports in the working tree.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--", "shared", "tools", "index.html", "README.md"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [ROOT / line for line in result.stdout.splitlines() if line]


def source_stats(paths: list[Path]) -> tuple[int, int, int]:
    source = [
        path
        for path in paths
        if path.suffix in {".html", ".css", ".js"}
        and (
            path == ROOT / "index.html"
            or path.is_relative_to(ROOT / "shared")
            or path.is_relative_to(ROOT / "tools")
        )
    ]
    return (
        len(source),
        sum(path.stat().st_size for path in source),
        sum(path.read_text(encoding="utf-8").count("\n") for path in source),
    )


def main() -> None:
    paths = tracked_paths()
    entrypoints = sorted(ROOT.glob("tools/*/index.html"))
    navigation = (ROOT / "shared/js/navigation.js").read_text(encoding="utf-8")
    unified_data = (ROOT / "shared/js/unified-data.js").read_text(encoding="utf-8")

    source_file_count, source_bytes, source_lines = source_stats(paths)
    navigation_tools = re.findall(r"\{ id: '([^']+)', number:", navigation)
    migrations = re.findall(r"^\s+(\d+): migrate", unified_data, re.MULTILINE)
    external_scripts = sorted(
        set(
            re.findall(
                r'<script[^>]+src="(https?://[^\"]+)"',
                "\n".join(
                    path.read_text(encoding="utf-8")
                    for path in entrypoints
                ),
            )
        )
    )
    data_version = re.search(r"export const DATA_VERSION = (\d+);", unified_data)
    storage_key = re.search(r"export const STORAGE_KEY = '([^']+)';", unified_data)

    print(f"tool_entrypoints={len(entrypoints)}")
    print("tool_names=" + ",".join(path.parent.name for path in entrypoints))
    print(f"navigation_tools={len(navigation_tools)}")
    print(f"source_files={source_file_count}")
    print(f"source_bytes={source_bytes}")
    print(f"source_lines={source_lines}")
    print(f"data_version={data_version.group(1) if data_version else 'not found'}")
    print(f"migration_steps={len(migrations)}")
    print(f"storage_key={storage_key.group(1) if storage_key else 'not found'}")
    print(f"external_script_urls={len(external_scripts)}")
    for url in external_scripts:
        print(f"external_script={url}")


if __name__ == "__main__":
    main()
