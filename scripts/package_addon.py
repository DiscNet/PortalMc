#!/usr/bin/env python3
"""Validate and package PortalMc as an importable Bedrock .mcaddon (stdlib only)."""
import json
import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "PortalMc-1.20.80-v0.2.0.mcaddon"

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
    expected += [ROOT / "resource_pack" / "textures" / "items" / "portal_gun.png"]
    expected += [ROOT / "resource_pack" / "textures" / "entity" / "portal_gun.png"]
    expected += [ROOT / "resource_pack" / "textures" / "portal_samples" / (n + ".png") for n in ("air","stone","grass","leaves","dirt","wood","sand","water","lava","snow","dark","ore")]
    for path in expected:
        assert path.is_file() and path.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), f"Invalid texture: {path}"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # O formato .mcaddon mais portavel e um zip contendo dois .mcpack.
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as addon:
        for dirname, filename in (("behavior_pack", "PortalMc_Behavior.mcpack"),
                                  ("resource_pack", "PortalMc_Resources.mcpack")):
            data = io.BytesIO()
            with zipfile.ZipFile(data, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as pack:
                for path in sorted((ROOT / dirname).rglob("*")):
                    if path.is_file():
                        pack.write(path, path.relative_to(ROOT / dirname).as_posix())
            addon.writestr(filename, data.getvalue())
    with zipfile.ZipFile(OUT) as addon:
        assert addon.testzip() is None
        assert sorted(addon.namelist()) == ["PortalMc_Behavior.mcpack", "PortalMc_Resources.mcpack"]
        for name in addon.namelist():
            with zipfile.ZipFile(io.BytesIO(addon.read(name))) as nested:
                assert "manifest.json" in nested.namelist()
                assert nested.testzip() is None
    print(f"Created: {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")

if __name__ == "__main__":
    try:
        build()
    except (OSError, ValueError, AssertionError, KeyError) as exc:
        print(f"PortalMc build failed: {exc}", file=sys.stderr)
        sys.exit(1)
