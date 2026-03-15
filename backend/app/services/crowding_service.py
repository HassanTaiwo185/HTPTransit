"""
crowding_service.py — ML crowding prediction only.
Labels: not_crowded | normal | overcrowded
"""
import logging
from datetime import datetime
from app.ml.predictor import predict

logger = logging.getLogger(__name__)


def get_predicted_crowding(
    stop_lat:     float,
    stop_lon:     float,
    departure_ts: int,
) -> dict:
    dt         = datetime.fromtimestamp(departure_ts)
    hour       = dt.hour
    is_weekend = int(dt.weekday() >= 5)

    if 7 <= hour <= 9 or 16 <= hour <= 19:
        boardings, alightings = 150.0, 80.0
    elif 22 <= hour or hour <= 5:
        boardings, alightings = 10.0, 5.0
    else:
        boardings, alightings = 50.0, 25.0

    result = predict(
        boardings  = boardings,
        alightings = alightings,
        stop_lat   = stop_lat,
        stop_lon   = stop_lon,
        hour       = hour,
        is_weekend = is_weekend,
    )

    return {
        **result,
        "source":        "ml_prediction",
        "predicted_for": dt.isoformat(),
    }
