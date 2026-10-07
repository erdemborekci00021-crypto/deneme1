"""Build the offline Windows x64 distribution using a verified official runtime."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import struct
import subprocess
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v24.21.0"
NODE_SHA256 = "ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32"
DOWNLOADS = ROOT / "downloads"
CACHE = Path(tempfile.gettempdir()) / "cnc-windows-downloads"


def download(url, target):
    with urllib.request.urlopen(url, timeout=120) as response, target.open("wb") as out:
        shutil.copyfileobj(response, out)


def sha256(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(exist_ok=True)
    node = CACHE / "node.exe"
    base = f"https://nodejs.org/dist/{VERSION}/"
    with urllib.request.urlopen(base + "SHASUMS256.txt", timeout=60) as response:
        sums = response.read().decode()
    official = next(row.split()[0] for row in sums.splitlines() if row.split()[1] == "win-x64/node.exe")
    if official != NODE_SHA256:
        raise RuntimeError("Official checksum disagrees with pinned checksum; stop and investigate.")
    if not node.exists():
        download(base + "win-x64/node.exe", node)
    if sha256(node) != NODE_SHA256:
        raise RuntimeError("Runtime checksum verification failed; no package created.")
    with node.open("rb") as f:
        assert f.read(2) == b"MZ", "Not a Windows executable"
        f.seek(0x3C)
        pe_offset = struct.unpack("<I", f.read(4))[0]
        f.seek(pe_offset)
        assert f.read(4) == b"PE\x00\x00"
        assert struct.unpack("<H", f.read(2))[0] == 0x8664, "Not a Windows x64 runtime"
    license_file = CACHE / "NODE-LICENSE.txt"
    download(f"https://raw.githubusercontent.com/nodejs/node/{VERSION}/LICENSE", license_file)
    if not (ROOT / "dist/index.html").exists():
        raise RuntimeError("Run npm run build before packaging.")
    with tempfile.TemporaryDirectory(prefix="cnc-portable-") as folder:
        stage = Path(folder) / "Atolye"
        stage.mkdir()
        for name in ("package.json", "package-lock.json", "README.md"):
            shutil.copy2(ROOT / name, stage / name)
        for name in ("server", "dist"):
            shutil.copytree(ROOT / name, stage / name)
        (stage / "runtime").mkdir()
        shutil.copy2(node, stage / "runtime/node.exe")
        shutil.copy2(license_file, stage / "runtime/NODE-LICENSE.txt")
        (stage / "data").mkdir()
        for p in (ROOT / "portable").iterdir():
            shutil.copy2(p, stage / p.name)
        (stage / "RUNTIME-SHA256.txt").write_text(f"{NODE_SHA256}  runtime/node.exe\n", encoding="utf-8")
        (stage / "RUNTIME-VERSION.txt").write_text(VERSION + "\n", encoding="utf-8")
        subprocess.run(["npm", "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", str(CACHE / "npm-cache")], cwd=stage, check=True, shell=os.name == "nt")
        output = DOWNLOADS / "atolye-windows-x64.zip"
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr("Atolye/data/", "")
            for p in sorted(stage.rglob("*")):
                if p.is_file():
                    z.write(p, "Atolye/" + p.relative_to(stage).as_posix())
        with zipfile.ZipFile(output) as z:
            if z.testzip() is not None:
                raise RuntimeError("ZIP integrity check failed")
            for name in ("Atolye/runtime/node.exe", "Atolye/launcher.js", "Atolye/BASLAT.cmd", "Atolye/dist/index.html", "Atolye/node_modules/express/index.js"):
                assert name in z.namelist(), name
            assert not any("workshop.sqlite" in name for name in z.namelist())
        (DOWNLOADS / "SHA256SUMS.txt").write_text(f"{sha256(output)}  {output.name}\n", encoding="utf-8")
        print(f"Verified portable distribution: {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
