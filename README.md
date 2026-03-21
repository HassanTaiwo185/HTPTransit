HTPTransit — Intelligent Transit Backend

HTPTransit is a real-time + predictive transit backend built with FastAPI that combines:

🛰️ Live transit data (Transit API)
📊 Static GTFS data (in-memory fallback)
🤖 Machine Learning crowding prediction
🌍 Geospatial intelligence (population density)

It is designed to simulate a modern transit system backend with real-time updates, route planning, and predictive insights.

🚀 Features
🕒 Real-Time Arrivals
Fetches live arrivals from Transit API
Fallback to static GTFS if API fails
Returns:
Next arrival
Next 2–3 departures
Real-time status
📍 Nearby Stops
Finds stops within a radius using Haversine formula
Fully in-memory (no database)
Sorted by closest distance
🛣 Trip Stop Sequences
Returns ordered stops for a trip
Uses GTFS stop_times
🧭 Route Planning
Multi-leg journey planning
Includes:
Transit + walking legs
Stop-by-stop schedule
Real-time validation (≤ 30 min window)
Next departures per leg
🤖 Crowding Prediction (ML)

Predicts bus crowding level:

not_crowded
normal
overcrowded

Uses:

Time of day
Day of week
Route count
Population density (Stats Canada)
Nearby schools
🤖 Machine Learning Overview
🎯 Goal

Predict crowding without using passenger counts at runtime.

🧮 Target Labels

Derived from CTA (Chicago) data:

Label	Class	Condition
0	not_crowded	< 50% capacity
1	normal	50% – 85%
2	overcrowded	> 85%
net_passengers = boardings - alightings
crowding_ratio = net_passengers / 50
🧠 Features (No Leakage)

Only time + location + context:

Time

hour
peak hours (7–9 AM, 4–7 PM)
weekend / weekday

Location

latitude / longitude
population density (Stats Canada DA)

Context

route count
nearby schools
interaction features
⚙️ Models
Model	Purpose
Random Forest	Baseline
XGBoost	Final model (best performance)
Stratified train/val/test split
5-fold cross-validation
Feature scaling applied
📊 Output
model.pkl → trained model
scaler.pkl → feature scaler
model_metadata.pkl → config + metrics
confusion_matrix.png
feature_importance.png
🌍 Geospatial Intelligence
Uses Stats Canada Dissemination Areas
Maps each stop → real population density
Implemented with:
GeoPandas
Shapely (point-in-polygon)
🧱 System Architecture
Client (React + Map)
        ↓
FastAPI Backend
        ↓
 ┌──────────────────────────┐
 │ Transit API (real-time)  │
 └──────────────────────────┘
        ↓
 ┌──────────────────────────┐
 │ GTFS In-Memory Store     │
 └──────────────────────────┘
        ↓
 ┌──────────────────────────┐
 │ ML Prediction Layer      │
 └──────────────────────────┘
📦 Tech Stack
Backend
FastAPI
Uvicorn
WebSockets
HTTPX
SlowAPI (rate limiting)
Pydantic
Data
GTFS (in-memory)
Transit API
Machine Learning
scikit-learn
XGBoost
pandas / numpy
Geospatial
GeoPandas
Shapely
Frontend (preconfigured)
Tailwind CSS
MapLeaf
🛠 Installation & Setup
1. Clone Repo
git clone https://github.com/HassanTaiwo185/HTPTransit
cd HTPTransit
2. Install Backend Dependencies
pip install -r requirements.txt
3. Install Frontend Dependencies
npm install
4. Environment Variables

Create .env:

TRANSIT_API_KEY=your_api_key
TRANSIT_BASE_URL=https://external.transitapp.com/v3
▶️ Run the App
Option 1 (Recommended)
bash setup.sh

This will:

Install dependencies
Train ML model (if missing)
Load geospatial data
Start server
Option 2 (Manual)
Step 1 — Train ML Model
python3 app/ml/train.py
Step 2 — Start Server
uvicorn app.main:app --reload
🌐 Access API
API → http://localhost:8000
Docs → http://localhost:8000/docs
🧪 Example Capabilities
Get nearby stops
Get live arrivals
View trip stop sequence
Plan routes
Predict crowding per stop
