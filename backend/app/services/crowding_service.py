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
    route_count:        int   = 1,
    population_density: float = 1800.0,
) -> dict:
    dt         = datetime.fromtimestamp(departure_ts)
    hour       = dt.hour
    day_of_week = dt.weekday()
    is_weekend  = int(day_of_week >= 5)

    result = predict(
        stop_lat           = stop_lat,
        stop_lon           = stop_lon,
        hour               = hour,
        is_weekend         = is_weekend,
        day_of_week        = day_of_week,
        route_count        = route_count,
        population_density = population_density,
    )

    return {
        **result,
        "source":        "ml_prediction",
        "predicted_for": dt.isoformat(),
    }