#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ ! -f .venv/bin/python ]; then python3 -m venv .venv; fi
if ! .venv/bin/python -c 'import duckdb' >/dev/null 2>&1; then
 .venv/bin/python -m pip install -r requirements.txt
fi
exec .venv/bin/python server.py "$@"
