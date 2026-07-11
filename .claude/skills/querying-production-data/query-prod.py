#!/usr/bin/env python3
"""Run a READ-ONLY SQL query against the linked production Supabase project.

Local Supabase (`.env.local` → 127.0.0.1) holds only dev seed data. This hits
the real production DB so design decisions rest on real usage, not an empty
seed.

Auth chain (no secrets are stored or printed):
  * Project ref  ← supabase/.temp/project-ref  (set by `supabase link`)
  * Access token ← macOS keychain, service "Supabase CLI" (`supabase login`)
  * Transport    ← Supabase Management API /database/query, with a browser
                   User-Agent (the API is behind Cloudflare, which 403s the
                   default urllib UA with "error code: 1010").

Safety: refuses anything that isn't a single SELECT/WITH/EXPLAIN/SHOW/TABLE
statement. This is a read tool for analysis, never for writes.

Usage:
  .claude/skills/querying-production-data/query-prod.py "select count(*) from mmg_entries"
  echo "select ..." | .claude/skills/querying-production-data/query-prod.py -
"""
import json, subprocess, sys, urllib.request, urllib.error, pathlib, re

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")
READ_ONLY = re.compile(r"^\s*(with|select|explain|show|table)\b", re.I)


def project_ref() -> str:
    p = pathlib.Path("supabase/.temp/project-ref")
    if not p.exists():
        sys.exit("No supabase/.temp/project-ref — run `supabase link` first.")
    return p.read_text().strip()


def access_token() -> str:
    try:
        t = subprocess.check_output(
            ["security", "find-generic-password", "-w", "-s", "Supabase CLI"],
            text=True, stderr=subprocess.DEVNULL).strip()
    except subprocess.CalledProcessError:
        t = ""
    if not t:
        sys.exit("No Supabase CLI token in keychain — run `supabase login`.")
    return t


def run(sql: str) -> None:
    core = sql.strip().rstrip(";").strip()
    if not READ_ONLY.match(core):
        sys.exit("Refused: only read-only statements (SELECT/WITH/EXPLAIN/SHOW/TABLE).")
    if ";" in core:
        sys.exit("Refused: multiple statements are not allowed.")
    ref = project_ref()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": "Bearer " + access_token(),
                 "Content-Type": "application/json",
                 "User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(json.dumps(json.load(r), indent=2, default=str))
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:400]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    run(sys.stdin.read() if sys.argv[1] == "-" else sys.argv[1])
