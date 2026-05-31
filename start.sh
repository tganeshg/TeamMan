#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== TeamMan Startup ==="

# Backend
echo "[1/3] Setting up backend virtualenv and dependencies..."
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
  python3.10 -m venv .venv
fi
.venv/bin/pip install -r requirements.txt -q

echo "[2/3] Starting backend on http://localhost:8000 ..."
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
echo "[3/3] Installing and starting frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/frontend"
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

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
