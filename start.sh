#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== TeamMan Startup ==="

# Preflight: verify Node/npm exist before starting anything, so a missing
# frontend toolchain does not leave an orphaned backend process behind.
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found - the frontend cannot start."
  echo ""
  echo "  Install Node.js (18 LTS or newer), then re-run ./start.sh"
  echo ""
  echo "  Debian / Ubuntu:"
  echo "    sudo apt update && sudo apt install -y nodejs npm"
  echo ""
  echo "  Or a current LTS via NodeSource:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "    sudo apt install -y nodejs"
  exit 1
fi

# Backend
echo "[1/3] Setting up backend virtualenv and dependencies..."
cd "$SCRIPT_DIR/backend"

# Pick an available Python 3.10+ interpreter
PY=""
for cand in python3.12 python3.11 python3.10 python3; do
  if command -v "$cand" &>/dev/null; then
    ver=$("$cand" -c 'import sys; print(sys.version_info[0]*100+sys.version_info[1])' 2>/dev/null || echo 0)
    if [ "$ver" -ge 310 ]; then PY="$cand"; break; fi
  fi
done
if [ -z "$PY" ]; then
  echo "ERROR: No Python 3.10+ found. Install python3 (>=3.10) and the venv module."
  exit 1
fi
echo "      Using $PY ($($PY --version 2>&1))"

# Recreate the venv if it is missing or incomplete (no pip)
if [ ! -x ".venv/bin/pip" ]; then
  if [ -d ".venv" ]; then
    echo "      Existing .venv is incomplete - recreating..."
    rm -rf .venv
  fi
  if ! "$PY" -m venv .venv 2>/dev/null; then
    echo "      venv with pip failed - retrying without pip, then bootstrapping..."
    "$PY" -m venv --without-pip .venv || {
      echo "ERROR: Could not create a virtualenv."
      echo "       On Debian/Ubuntu install it with:  sudo apt install python3-venv"
      exit 1
    }
  fi
fi

# Bootstrap pip if the venv still has none (ensurepip missing on some distros)
if [ ! -x ".venv/bin/pip" ]; then
  .venv/bin/python -m ensurepip --upgrade 2>/dev/null || {
    echo "      ensurepip unavailable - fetching get-pip.py..."
    curl -fsSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
    .venv/bin/python /tmp/get-pip.py
    rm -f /tmp/get-pip.py
  }
fi

if [ ! -x ".venv/bin/pip" ]; then
  echo "ERROR: pip is still missing inside .venv - cannot install dependencies."
  exit 1
fi

.venv/bin/pip install -r requirements.txt -q

echo "[2/3] Starting backend on http://localhost:3001 ..."

# Free port 3001 if a previous run left a backend behind
if command -v fuser &>/dev/null; then
  fuser -k 3001/tcp &>/dev/null || true
else
  pkill -f "uvicorn main:app" &>/dev/null || true
fi
sleep 1

.venv/bin/uvicorn main:app --host 0.0.0.0 --port 3001 --reload &
BACKEND_PID=$!

# From here on, always clean up the backend on any exit path
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' SIGINT SIGTERM EXIT

# Frontend
echo "[3/3] Installing and starting frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/frontend"

# A node_modules tree copied from Windows loses its execute bits, so the
# vite binary fails with "Permission denied". Reinstall natively if so.
if [ -d node_modules ] && [ ! -x node_modules/.bin/vite ]; then
  echo "      node_modules is not executable (copied from another OS) - reinstalling..."
  rm -rf node_modules package-lock.json
fi

npm install --silent
npm run dev &
FRONTEND_PID=$!

echo ""
echo "TeamMan is starting..."
sleep 4

# Open browser
if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
elif command -v open &>/dev/null; then
  open http://localhost:3000
fi

echo "Backend PID: $BACKEND_PID  |  Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."

wait
