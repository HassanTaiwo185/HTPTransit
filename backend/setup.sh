#!/bin/bash
# setup.sh — one command to set up and run Durham Transit backend
# Usage: bash setup.sh

set -e   # stop on any error

echo "=================================================="
echo "  Durham Transit Backend — Setup"
echo "=================================================="

# ── 1. Check Python ───────────────────────────────────────────
echo ""
echo "[1/6] Checking Python..."
python3 --version || { echo "❌ Python3 not found. Install it first."; exit 1; }

# ── 2. Install dependencies ───────────────────────────────────
echo ""
echo "[2/6] Installing dependencies..."
pip install -r requirements.txt

# ── 3. Check .env ─────────────────────────────────────────────
echo ""
echo "[3/6] Checking .env..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  ⚠️  .env created from .env.example"
        echo "  ⚠️  Add your TRANSIT_API_KEY to .env before continuing"
        echo ""
        read -p "  Press Enter after you have added your API key..."
    else
        echo "  ⚠️  No .env file found. Creating one..."
        echo "TRANSIT_API_KEY=your_key_here" > .env
        echo "  ⚠️  Add your TRANSIT_API_KEY to .env then run again"
        exit 1
    fi
else
    echo "  .env found"
fi

# ── 4. Train ML model if needed ───────────────────────────────
echo ""
echo "[4/6] Checking ML model..."
if [ ! -f "app/ml/model.pkl" ]; then
    echo "  model.pkl not found — training now..."
    echo "  This takes about 2 minutes..."

    # install libomp on Mac for XGBoost
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install libomp 2>/dev/null || true
    fi

    mkdir -p app/ml
    python3 ml/train.py
    echo "  Model trained and saved to app/ml/"
else
    echo "  model.pkl found — skipping training"
fi

# ── 5. Geocode Durham schools if needed ───────────────────────
echo ""
echo "[5/6] Checking Durham school locations..."
if [ ! -f "data/durham_schools_geocoded.csv" ]; then
    echo "  Geocoding Durham schools..."
    python3 ml/geocode_schools.py
    echo "  Schools geocoded"
else
    echo "   Durham schools already geocoded"
fi

# ── 6. Start server ───────────────────────────────────────────
echo ""
echo "[6/6] Starting Durham Transit API..."
echo ""
echo "=================================================="
echo "  Server starting at http://localhost:8000"
echo "  API docs at    http://localhost:8000/docs"
echo "  Press Ctrl+C to stop"
echo "=================================================="
echo ""
uvicorn app.main:app --reload