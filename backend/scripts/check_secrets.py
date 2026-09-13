"""Read-only scan of versionable files and browser bundles. Never prints values."""

import json
import re
import subprocess
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV_FILES = ("backend/.env", ".env.local", "tests/.env.live")
PATTERN = re.compile(
    rb"sk-(?:proj-)?[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|https?://[^\s/:]+:[^\s/@]+@"
)


def scan():
    values = []
    for file in ENV_FILES:
        for name, value in dotenv_values(ROOT / file).items():
            if (
                value
                and len(value) > 7
                and (
                    "PASSWORD" in name
                    or "SECRET" in name
                    or ("KEY" in name and "PUBLISHABLE" not in name)
                )
            ):
                values.append(value.encode())
    files = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT
        )
        .decode()
        .split("\0")
    )
    targets = {ROOT / file for file in files if file}
    bundles = {p for p in (ROOT / ".next/static").rglob("*") if p.is_file()}
    hits = []
    for path in sorted(targets | bundles):
        if path.is_file():
            content = path.read_bytes()
            if any(value in content for value in values) or PATTERN.search(content):
                hits.append(str(path.relative_to(ROOT)))
    ignored = {
        file: subprocess.run(["git", "check-ignore", "-q", file], cwd=ROOT, check=False).returncode
        == 0
        and file not in files
        for file in ENV_FILES
    }
    result = {
        "versionable_files_scanned": len(targets),
        "browser_bundle_files_scanned": len(bundles),
        "flagged_paths": hits,
        "credential_files_ignored_and_untracked": ignored,
        "passed": not hits and all(ignored.values()),
    }
    print(json.dumps(result))
    return result["passed"]


if __name__ == "__main__":
    raise SystemExit(0 if scan() else 1)
