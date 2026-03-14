"""
predictor.py — loads the trained model and predicts occupancy.
Uses Durham schools geocoded data for schools_nearby feature.
"""
import pickle
import logging
import math
import numpy as np
import pandas as pd
from pathlib import Path

logger = logging.getLogger(__name__)

ML_DIR   = Path(__file__).resolve().parent
DATA_DIR = ML_DIR.parent.parent / "data"

model          = None
scaler         = None
metadata       = None
durham_schools = None

# Durham Region bounding box — reject predictions outside this area
DURHAM_BOUNDS = {
    "lat_min": 43.7000,
    "lat_max": 44.3000,
    "lon_min": -79.3000,
    "lon_max": -78.5000,
}


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _is_in_durham(lat: float, lon: float) -> bool:
    """Check if lat/lon is within Durham Region bounds."""
    return (
        DURHAM_BOUNDS["lat_min"] <= lat <= DURHAM_BOUNDS["lat_max"] and
        DURHAM_BOUNDS["lon_min"] <= lon <= DURHAM_BOUNDS["lon_max"]
    )


def _count_schools_nearby(lat: float, lon: float, radius_km: float = 0.5) -> int:
    """Count Durham schools within radius_km of a stop."""
    if durham_schools is None:
        return 0
    count = 0
    for _, school in durham_schools.iterrows():
        try:
            dist = _haversine(lat, lon, school['lat'], school['lon'])
            if dist <= radius_km:
                count += 1
        except Exception:
            pass
    return count


def load_model():
    """Call once at startup from main.py."""
    global model, scaler, metadata, durham_schools

    model_path    = ML_DIR / "model.pkl"
    scaler_path   = ML_DIR / "scaler.pkl"
    metadata_path = ML_DIR / "model_metadata.pkl"
    schools_path  = DATA_DIR / "durham_schools_geocoded.csv"

    if not model_path.exists():
        logger.warning("model.pkl not found — predictions disabled")
        return

    try:
        with open(model_path,    "rb") as f: model    = pickle.load(f)
        with open(scaler_path,   "rb") as f: scaler   = pickle.load(f)
        with open(metadata_path, "rb") as f: metadata = pickle.load(f)
        logger.info("ML model loaded — %s (accuracy: %s)",
                    metadata["model_name"], metadata["accuracy"])
    except Exception as e:
        logger.error("Failed to load model: %s", e)
        return

    if schools_path.exists():
        try:
            durham_schools = pd.read_csv(schools_path)
            logger.info("Loaded %d Durham schools", len(durham_schools))
        except Exception as e:
            logger.warning("Could not load Durham schools: %s", e)
    else:
        logger.warning("durham_schools_geocoded.csv not found — schools_nearby=0")


def predict(
    boardings:          float,
    alightings:         float,
    stop_lat:           float = None,
    stop_lon:           float = None,
    route_count:        int   = 1,
    hour:               int   = 12,
    is_weekend:         int   = 0,
    population_density: float = 1800.0,
) -> dict:
    """
    Predict crowding level for a Durham Transit stop.
    Returns level (not_crowded / normal / overcrowded) + confidence.
    """

    # ── model not loaded ──────────────────────────────────────
    if model is None or scaler is None:
        return {
            "error":   "model_unavailable",
            "message": "ML model is not loaded. Please contact support.",
            "level":   None
        }

    # ── lat/lon missing ───────────────────────────────────────
    if stop_lat is None or stop_lon is None:
        return {
            "error":   "location_required",
            "message": "Stop location (lat/lon) is required for prediction.",
            "level":   None
        }

    # ── validate lat/lon are real numbers ─────────────────────
    try:
        stop_lat = float(stop_lat)
        stop_lon = float(stop_lon)
    except (TypeError, ValueError):
        return {
            "error":   "invalid_location",
            "message": "Invalid lat/lon values provided.",
            "level":   None
        }

    # ── outside Durham Region ─────────────────────────────────
    if not _is_in_durham(stop_lat, stop_lon):
        return {
            "error":   "outside_service_area",
            "message": f"Location ({stop_lat:.4f}, {stop_lon:.4f}) is outside Durham Region. We can only predict crowding for Durham Transit stops.",
            "level":   None
        }

    # ── invalid boardings/alightings ──────────────────────────
    try:
        boardings  = float(boardings)
        alightings = float(alightings)
        if boardings < 0 or alightings < 0:
            raise ValueError
    except (TypeError, ValueError):
        return {
            "error":   "invalid_ridership",
            "message": "Boardings and alightings must be non-negative numbers.",
            "level":   None
        }

    # ── count Durham schools nearby ───────────────────────────
    try:
        schools_nearby = _count_schools_nearby(stop_lat, stop_lon)
    except Exception as e:
        logger.warning("Could not count schools nearby: %s", e)
        schools_nearby = 0

    # ── engineer features ─────────────────────────────────────
    total_activity    = boardings + alightings
    boarding_ratio    = boardings  / (total_activity + 1)
    alighting_ratio   = alightings / (total_activity + 1)
    activity_log      = np.log1p(total_activity)
    is_morning_peak   = int(7  <= hour <= 9)
    is_afternoon_peak = int(16 <= hour <= 19)
    is_peak           = int(is_morning_peak or is_afternoon_peak)

    peak_x_activity = is_peak * total_activity
    peak_x_schools  = is_peak * schools_nearby
    pop_x_activity  = population_density * activity_log
    boarding_x_peak = boardings * is_peak

    features = np.array([[
        boardings, alightings, total_activity,
        boarding_ratio, alighting_ratio, activity_log,
        route_count, hour, is_morning_peak,
        is_afternoon_peak, is_peak, is_weekend,
        population_density, schools_nearby,
        peak_x_activity, peak_x_schools,
        pop_x_activity, boarding_x_peak,
    ]])

    # ── predict ───────────────────────────────────────────────
    try:
        features_scaled = scaler.transform(features)
        prediction      = model.predict(features_scaled)[0]
        probabilities   = model.predict_proba(features_scaled)[0]
        confidence      = round(float(probabilities.max()), 3)
    except Exception as e:
        logger.error("Prediction failed: %s", e)
        return {
            "error":   "prediction_failed",
            "message": "Prediction failed unexpectedly. Please try again.",
            "level":   None
        }

    label_map = metadata.get(
        "label_map",
        {0: "not_crowded", 1: "normal", 2: "overcrowded"}
    )

    return {
        "level":           label_map[int(prediction)],
        "confidence":      confidence,
        "schools_nearby":  schools_nearby,
        "stop_lat":        stop_lat,
        "stop_lon":        stop_lon,
        "hour":            hour,
        "is_peak":         bool(is_peak),
        "probabilities": {
            "not_crowded": round(float(probabilities[0]), 3),
            "normal":      round(float(probabilities[1]), 3),
            "overcrowded": round(float(probabilities[2]), 3),
        }
    }