#!/usr/bin/env python3
"""Validate and package PortalMc as an importable Bedrock .mcaddon (stdlib only)."""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "PortalMc-1.20.80-v0.1.0.mcaddon"

def validate_pack(folder, kind):
    pack = ROOT / folder
    manifest = json.loads((pack / "manifest.json").read_text(encoding="utf8"))
    assert manifest["format_version"] == 2
    assert manifest["header"]["min_engine_version"] == [1, 20, 80]
    assert any(m["type"] == kind for m in manifest["modules"])
    if kind == "data":
        assert any(d.get("module_name") == "@minecraft/server" and d.get("version") == "1.10.0"
                   for d in manifest["dependencies"])
    for path in pack.rglob("*.json"):
        json.loads(path.read_text(encoding="utf8"))
    return manifest

def build():
    b = validate_pack("behavior_pack", "data")
    r = validate_pack("resource_pack", "resources")
    assert any(d.get("uuid") == r["header"]["uuid"] for d in b["dependencies"])
    source = ROOT / "behavior_pack" / "scripts" / "main.js"
    assert source.is_file(), "Missing Script API entrypoint"
    expected = [ROOT / "resource_pack" / "textures" / "entity" / ("portal_" + c + ".png") for c in ("blue","orange")]
    expected += [ROOT / "resource_pack" / "textures" / "items" / n for n in ("portal_gun_blue.png","portal_gun_orange.png","portal_reset.png")]
    for path in expected:
        assert path.is_file() and path.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), f"Invalid texture: {path}"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as zf:
        for dirname in ("behavior_pack", "resource_pack"):
            for path in sorted((ROOT / dirname).rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(OUT) as zf:
        assert zf.testzip() is None
    print(f"Created: {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")

if __name__ == "__main__":
    try:
        build()
    except (OSError, ValueError, AssertionError, KeyError) as exc:
        print(f"PortalMc build failed: {exc}", file=sys.stderr)
        sys.exit(1)
