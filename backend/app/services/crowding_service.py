"""
crowding_service.py — hybrid crowding estimation.
- If bus is live (rt_trip_id present): scan WiFi/BT device count proxy via Transit API
- If future/scheduled: fall back to ML predictor
"""
import httpx
import logging
from datetime import datetime

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter
from app.ml.predictor import predict

logger = logging.getLogger(__name__)


def _devices_to_crowding(device_count: int) -> dict:
    """
    Convert estimated device count to crowding level.
    Assumes average bus capacity ~40 seated, ~20 standing.
    Device count proxy: each passenger carries ~1.2 devices on average.
    """
    if device_count is None:
        return {"level": "unknown", "source": "unavailable", "device_count": None}

    estimated_passengers = round(device_count / 1.2)

    if estimated_passengers < 10:
        level = "low"
    elif estimated_passengers < 30:
        level = "medium"
    else:
        level = "high"

    return {
        "level":                level,
        "source":               "live_scan",
        "device_count":         device_count,
        "estimated_passengers": estimated_passengers,
    }


async def get_live_crowding(rt_trip_id: str) -> dict:
    """
    Attempt to get live occupancy from Transit API vehicle data.
    Falls back to device scan estimate if occupancy_status not available.
    """
    await transit_limiter.acquire()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TRANSIT_BASE_URL}/vehicle/{rt_trip_id}",
                headers={"apiKey": TRANSIT_API_KEY},
                timeout=8.0
            )

            if response.status_code == 404:
                logger.warning("Live vehicle %s not found", rt_trip_id)
                return {"level": "unknown", "source": "unavailable"}

            response.raise_for_status()
            data = response.json()

        occupancy = data.get("occupancy_status")
        device_count = data.get("wifi_device_count") or data.get("bt_device_count")

        # Priority 1: real occupancy_status from API
        if occupancy:
            level_map = {
                "EMPTY":                    "low",
                "MANY_SEATS_AVAILABLE":     "low",
                "FEW_SEATS_AVAILABLE":      "medium",
                "STANDING_ROOM_ONLY":       "medium",
                "CRUSHED_STANDING_ROOM":    "high",
                "FULL":                     "high",
                "NOT_ACCEPTING_PASSENGERS": "high",
            }
            return {
                "level":            level_map.get(occupancy, "unknown"),
                "source":           "realtime_occupancy",
                "occupancy_status": occupancy,
            }

        # Priority 2: WiFi/BT device count
        if device_count is not None:
            return _devices_to_crowding(device_count)

        return {"level": "unknown", "source": "unavailable"}

    except Exception as e:
        logger.warning("Live crowding fetch failed for %s: %s", rt_trip_id, e)
        return {"level": "unknown", "source": "error"}


def get_predicted_crowding(
    stop_lat:   float,
    stop_lon:   float,
    departure_ts: int,        # unix timestamp of planned departure
) -> dict:
    """
    ML prediction for future/scheduled trips.
    """
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
        "source":       "ml_prediction",
        "predicted_for": dt.isoformat(),
    }