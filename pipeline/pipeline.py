#!/usr/bin/env python3
"""wow-plan data pipeline: fetch a Forever client build's tables, import them into Postgres.

  pipeline.py latest            newest Forever build wago.tools lists (any Forever product)
  pipeline.py fetch [build]     download the tables missing for a build (default: latest)
  pipeline.py import [build]    dbt build + publish to Postgres (default: newest fetched build)

Runs the same in the `pipeline` container (composer.yaml) and on the host (.venv). Standard
library only. Downloads are never repeated: delete refs/wago/<build>/<Table>.csv to fetch it again.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFS = Path(os.environ.get("WOW_REFS", ROOT / "refs"))
WAGO_DIR = REFS / "wago"
OPENDATA_DIR = REFS / "opendata"
DBT_DIR = ROOT / "dbt"
TABLES_FILE = Path(__file__).resolve().parent / "wago_tables.txt"

WAGO = "https://wago.tools"
OPENDATA_GIT = "https://github.com/wowlayerup-forever/opendata"
FOREVER_PRODUCTS = ("wowf", "wow_classic_beta")
FOREVER_PREFIX = "1.60."
USER_AGENT = "wow-plan pipeline (+https://github.com/romaninsh/wow-plan)"


def say(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    say(f"ERROR: {msg}")
    sys.exit(1)


def build_key(b: str) -> tuple[int, ...]:
    return tuple(int(x) for x in b.split("."))


def wago_tables() -> list[str]:
    lines = TABLES_FILE.read_text(encoding="utf-8").splitlines()
    return [l.strip() for l in lines if l.strip() and not l.lstrip().startswith("#")]


def http_get(url: str, dest: Path, attempts: int = 5) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
    delay = 2.0
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                dest.parent.mkdir(parents=True, exist_ok=True)
                tmp = dest.with_suffix(dest.suffix + ".part")
                with open(tmp, "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                tmp.rename(dest)
                return
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                fail(f"{url}: HTTP {e.code} (table not published for this build?)")
            if e.code == 429 or e.code >= 500:
                say(f"  HTTP {e.code}, retrying in {delay:.0f}s")
                time.sleep(delay)
                delay *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            say(f"  {e}, retrying in {delay:.0f}s")
            time.sleep(delay)
            delay *= 2
    fail(f"gave up on {url}")


def forever_builds() -> dict[str, list[str]]:
    """build -> products listing it, for every Forever build wago knows."""
    req = urllib.request.Request(f"{WAGO}/api/builds", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    out: dict[str, list[str]] = {}
    for product in FOREVER_PRODUCTS:
        for b in data.get(product, []):
            if b["version"].startswith(FOREVER_PREFIX):
                out.setdefault(b["version"], []).append(product)
    return out


def latest_build() -> tuple[str, list[str]]:
    builds = forever_builds()
    if not builds:
        fail("wago.tools lists no Forever (1.60.x) build")
    b = max(builds, key=build_key)
    return b, builds[b]


def fetched_builds() -> list[str]:
    if not WAGO_DIR.is_dir():
        return []
    return sorted((p.name for p in WAGO_DIR.iterdir() if p.is_dir() and p.name.startswith(FOREVER_PREFIX)), key=build_key)


def cmd_latest() -> None:
    b, products = latest_build()
    say(f"{b}  ({', '.join(products)})")


def cmd_fetch(build: str | None) -> None:
    if not build:
        build, products = latest_build()
        say(f"newest Forever build on wago.tools: {build} ({', '.join(products)})")
    else:
        products = forever_builds().get(build)
        if products is None:
            fail(f"wago.tools does not list {build} as a Forever build")
    dest = WAGO_DIR / build
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "_build.json").write_text(json.dumps({"build": build, "products": products}, indent=1) + "\n")

    tables = wago_tables()
    missing = [t for t in tables if not (dest / f"{t}.csv").exists()]
    say(f"{build}: {len(tables) - len(missing)} of {len(tables)} tables already downloaded, fetching {len(missing)}")
    for n, t in enumerate(missing, 1):
        q = urllib.parse.urlencode({"build": build, "useHotfixes": "1"})
        t0 = time.time()
        http_get(f"{WAGO}/db2/{t}/csv?{q}", dest / f"{t}.csv")
        size = (dest / f"{t}.csv").stat().st_size
        say(f"  [{n}/{len(missing)}] {t}: {size / 1e6:.1f} MB in {time.time() - t0:.1f}s")
        time.sleep(0.5)  # wago.tools is community-run; be polite

    if (OPENDATA_DIR / ".git").is_dir():
        say("opendata: already cloned (delete refs/opendata to fetch it again)")
    else:
        say(f"opendata: cloning {OPENDATA_GIT}")
        subprocess.run(["git", "clone", "--depth", "1", "-q", OPENDATA_GIT, str(OPENDATA_DIR)], check=True)
    say(f"fetch done: {dest}")


def find_pg_url() -> str:
    """WOW_PG_URL, else the composer postgres service's published port on this machine."""
    url = os.environ.get("WOW_PG_URL")
    if url:
        return url
    out = subprocess.run(
        ["docker", "ps", "--filter", "label=com.docker.compose.service=postgres",
         "--filter", f"label=com.docker.compose.project.working_dir={ROOT}",
         "--format", "{{.Ports}}"],
        capture_output=True, text=True,
    ).stdout
    for part in out.replace(",", " ").split():
        if "->5432/tcp" in part:
            port = part.split("->")[0].rsplit(":", 1)[-1]
            return f"postgresql://wow:wow@127.0.0.1:{port}/wow"
    fail("set WOW_PG_URL, or start the project's postgres service (Services in Vantage)")
    return ""


def dbt_cmd() -> list[str]:
    venv = ROOT / ".venv" / "bin" / "dbt"
    if venv.exists():
        return [str(venv)]
    if shutil.which("dbt"):
        return ["dbt"]
    fail("dbt not found: run in the pipeline container, or create .venv (see dbt/README.md)")
    return []


def cmd_import(build: str | None) -> None:
    builds = fetched_builds()
    if not build:
        if not builds:
            fail("nothing fetched yet: run Fetch build first")
        build = builds[-1]
    src = WAGO_DIR / build
    missing = [t for t in wago_tables() if not (src / f"{t}.csv").exists()]
    if missing:
        fail(f"{build} is missing {len(missing)} table(s): {', '.join(missing)}. Run Fetch build first.")
    if not (OPENDATA_DIR / ".git").is_dir():
        fail("refs/opendata is missing. Run Fetch build first.")

    meta = json.loads((src / "_build.json").read_text()) if (src / "_build.json").exists() else {}
    csvs = [src / f"{t}.csv" for t in wago_tables()]
    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(min(p.stat().st_mtime for p in csvs)))
    opendata_commit = subprocess.run(["git", "-C", str(OPENDATA_DIR), "rev-parse", "--short", "HEAD"],
                                     capture_output=True, text=True).stdout.strip() or "unknown"

    env = dict(os.environ)
    env["WOW_PG_URL"] = find_pg_url()
    scratch = os.environ.get("WOW_SCRATCH")
    if scratch:  # in the container dbt/ is read-only: keep dbt's output in scratch
        Path(scratch).mkdir(parents=True, exist_ok=True)
        env.setdefault("WOW_DUCKDB_PATH", f"{scratch}/wow.duckdb")
        env["DBT_TARGET_PATH"] = f"{scratch}/target"
        env["DBT_LOG_PATH"] = f"{scratch}/logs"
        env["DBT_PACKAGES_INSTALL_PATH"] = f"{scratch}/dbt_packages"
        env["DBT_SEND_ANONYMOUS_USAGE_STATS"] = "false"

    dbt = dbt_cmd() + ["--no-use-colors"]
    common = ["--profiles-dir", str(DBT_DIR), "--project-dir", str(DBT_DIR)]
    dbt_vars = json.dumps({
        "wago_build": build,
        "wago_product": ",".join(meta.get("products", [])),
        "fetched_at": fetched_at,
        "opendata_commit": opendata_commit,
    })
    say(f"import {build}: dbt build")
    # dbt runs inside dbt/: the project's relative paths (../refs, ../seeds, ../data) start there
    # --full-refresh: every import rebuilds from scratch (seeds whose columns changed included)
    r = subprocess.run(dbt + ["build", "--full-refresh"] + common + ["--vars", dbt_vars], env=env, cwd=DBT_DIR)
    if r.returncode != 0:
        fail("dbt build failed; Postgres was not changed")

    say(f"import {build}: publish to Postgres")
    manifest = Path(env.get("DBT_TARGET_PATH", DBT_DIR / "target")) / "manifest.json"
    duckdb_path = env.get("WOW_DUCKDB_PATH", str(ROOT / "data" / "wow.duckdb"))
    venv_python = ROOT / ".venv" / "bin" / "python"
    python = str(venv_python) if venv_python.exists() else sys.executable  # needs the duckdb module
    publish = Path(__file__).resolve().parent / "publish.py"
    r = subprocess.run([python, "-I", str(publish), str(manifest), duckdb_path, env["WOW_PG_URL"]], env=env)
    if r.returncode != 0:
        fail("publish failed; the live schema was not swapped")
    say(f"import done: {build} is live in schema wow")


def main(argv: list[str]) -> None:
    if not argv or argv[0] in ("-h", "--help"):
        say(__doc__.strip())
        return
    cmd, build = argv[0], (argv[1].strip() if len(argv) > 1 and argv[1].strip() else None)
    if cmd == "latest":
        cmd_latest()
    elif cmd == "fetch":
        cmd_fetch(build)
    elif cmd == "import":
        cmd_import(build)
    else:
        fail(f"unknown command {cmd!r}")


if __name__ == "__main__":
    main(sys.argv[1:])
