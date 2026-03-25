# HTPTransit — Intelligent Transit Backend

HTPTransit is a real-time + predictive transit backend built with FastAPI that combines:

- Live transit data (Transit API)
- Static GTFS data (in-memory fallback)
- Machine Learning crowding prediction
- Geospatial intelligence (population density via Stats Canada)

Designed to simulate a modern transit system backend with real-time updates, route planning, and predictive insights — built for Durham Region Transit (DRT).

---

## Features

### Real-Time Arrivals
- Fetches live arrivals from Transit API
- Fallback to static GTFS if API fails
- Returns: next arrival, next 2–3 departures, real-time status

### Nearby Stops
- Finds stops within a configurable radius using the Haversine formula
- Fully in-memory — no database needed
- Sorted by closest distance

### Trip Stop Sequences
- Returns ordered stops for any trip
- Uses GTFS `stop_times`

### Route Planning
- Multi-leg journey planning
- Includes: transit + walking legs, stop-by-stop schedule, real-time validation (30 min window), next departures per leg

### Crowding Prediction (ML)
Predicts bus crowding level per departure:

| Level | Meaning |
|---|---|
| `not_crowded` | Under 50% capacity |
| `normal` | 50–85% capacity |
| `overcrowded` | Over 85% capacity |

Uses: time of day, day of week, route count, population density (Stats Canada), nearby schools

---

## Machine Learning Overview

### Goal
Predict crowding without using passenger counts at runtime — time + location + context only.

### Target Labels
Derived from CTA (Chicago) ridership data via transfer learning:
```
net_passengers = boardings - alightings
crowding_ratio = net_passengers / 50  (bus capacity)

0 -> not_crowded  (ratio < 0.50)
1 -> normal       (ratio 0.50–0.85)
2 -> overcrowded  (ratio > 0.85)
```

### Features (No Data Leakage)
Only time + location + context — no passenger counts at inference:

**Time**
- Hour of day
- Morning peak (7–9 AM) / Afternoon peak (4–7 PM)
- Weekend / weekday

**Location**
- Latitude / longitude
- Population density (Stats Canada Dissemination Areas)

**Context**
- Route count per stop
- Nearby schools (within 500m)
- Interaction features (peak x schools, pop x peak, etc.)

### Models

| Model | Role |
|---|---|
| Random Forest | Baseline |
| XGBoost | Challenger |

- Stratified train / val / test split (60/20/20)
- 5-fold cross-validation
- Feature scaling applied (StandardScaler)
- Winner selected by validation accuracy

### Output
```
app/ml/
├── model.pkl              # trained model
├── scaler.pkl             # feature scaler
├── model_metadata.pkl     # config + metrics
├── confusion_matrix.png
└── feature_importance.png
```

---

## Geospatial Intelligence

- Uses Stats Canada 2021 Dissemination Areas shapefile (`lda_000a21a_e`)
- Joins `OntarioCensus.csv` on DGUID for real population density per km2
- Maps each stop to its DA polygon via point-in-polygon lookup
- Implemented with GeoPandas + Shapely
- Reprojected from EPSG:3347 to WGS84 at startup

Note: The shapefile is excluded from git (over 100MB). Place it in `backend/data/canada_polyline/` locally.

---

## System Architecture
```
Client (React + Leaflet Map)
        |
  FastAPI Backend
        |
+-------------------------+
|  Transit API (live)     |  <- real-time arrivals
+-------------------------+
        |
+-------------------------+
|  GTFS In-Memory Store   |  <- stops, trips, routes, calendar
+-------------------------+
        |
+-------------------------+
|  ML Prediction Layer    |  <- crowding per stop/departure
+-------------------------+
        |
+-------------------------+
|  Geospatial Layer       |  <- Stats Canada DA -> pop density
+-------------------------+
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| Backend | FastAPI, Uvicorn, WebSockets, HTTPX, SlowAPI, Pydantic |
| Data | GTFS (in-memory), Transit API |
| ML | scikit-learn, XGBoost, pandas, numpy |
| Geospatial | GeoPandas, Shapely |
| Frontend | React, Leaflet, Tailwind CSS |

---

## Installation & Setup

### 1. Clone the repo
```bash
git clone https://github.com/HassanTaiwo185/HTPTransit
cd HTPTransit
```

### 2. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies
```bash
cd frontend
npm install
```

### 4. Environment variables
Create `backend/.env`:
```
TRANSIT_API_KEY=your_api_key
TRANSIT_BASE_URL=https://external.transitapp.com/v3
```

### 5. Add geospatial data (not in git)
Download the Stats Canada 2021 DA shapefile and place all files in:
```
backend/data/canada_polyline/
```

---

## Run the App

### Option 1 — Recommended
```bash
bash setup.sh
```
This will: install dependencies, train the ML model (if missing), load geospatial data, and start the server.

### Option 2 — Manual

Step 1 — Train ML model:
```bash
cd backend
python3 ml/train.py
```

Step 2 — Start server:
```bash
uvicorn app.main:app --reload
```

### Access
- API -> http://localhost:8000
- Docs -> http://localhost:8000/docs

---

## Example Capabilities

- Get nearby stops by GPS location
- Fetch live arrivals with real-time status
- View full stop sequence for any trip
- Plan multi-leg routes with walking directions
- Predict crowding level per stop and departure time

---

## Project Structure
```
HTPTransit/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── services/
│   │   ├── data/
│   │   │   ├── loader.py
│   │   │   └── store.py
│   │   └── ml/
│   │       ├── predictor.py
│   │       ├── model.pkl
│   │       └── scaler.pkl
│   ├── ml/
│   │   └── train.py
│   └── data/
│       ├── stops.txt
│       ├── trips.txt
│       ├── stop_times.txt
│       ├── routes.txt
│       ├── calendar.txt
│       ├── OntarioCensus.csv
│       ├── durham_schools_geocoded.csv
│       └── canada_polyline/   <- gitignored (too large)
└── frontend/
    └── src/
```

---

*Built for hackathon — Transfer learning: Chicago CTA -> Durham Region Transit*
