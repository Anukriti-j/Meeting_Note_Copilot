#!/usr/bin/env bash
# Start both the FastAPI backend and the React frontend dev server.
# Usage: ./start.sh [dev|prod]
set -e

MODE="${1:-dev}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Meeting Notes Copilot — Starting in $MODE mode"

cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- Backend ---
echo "Starting FastAPI backend on :8000 ..."
cd "$ROOT_DIR"
source venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# --- Frontend ---
if [ "$MODE" = "prod" ]; then
  echo "Serving frontend from dist/ on :5173 ..."
  cd "$ROOT_DIR/frontend"
  npx serve dist -l 5173 &
  FRONTEND_PID=$!
else
  echo "Starting Vite dev server on :5173 ..."
  cd "$ROOT_DIR/frontend"
  npm run dev -- --host 0.0.0.0 &
  FRONTEND_PID=$!
fi

echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000/docs"
echo ""

wait $BACKEND_PID $FRONTEND_PID
