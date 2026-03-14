"""
stops_service.py — find nearby stops using user lat/lon.
Uses stop_info already loaded in memory. No database needed.
"""
import math
import logging
from app.data import store

logger = logging.getLogger(__name__)


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Returns distance in kilometers between two lat/lon points.
    """
    R = 6371  # Earth radius in km

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)

    return R * 2 * math.asin(math.sqrt(a))


def get_nearby_stops(lat: float, lon: float, radius_km: float = 0.5) -> list:
    """
    Returns all stops within radius_km of the user's location.
    Sorted by distance, closest first.
    """
    nearby = []

    for stop_id, info in store.stop_info.items():
        if info["stop_lat"] is None or info["stop_lon"] is None:
            continue

        distance = _haversine(lat, lon, info["stop_lat"], info["stop_lon"])

        if distance <= radius_km:
            nearby.append({
                "stop_id":   stop_id,
                "stop_name": info["stop_name"],
                "stop_lat":  info["stop_lat"],
                "stop_lon":  info["stop_lon"],
                "distance_km": round(distance, 3)
            })

    # closest stop first
    nearby.sort(key=lambda x: x["distance_km"])

    logger.info("Found %d stops within %.1fkm of (%.4f, %.4f)",
                len(nearby), radius_km, lat, lon)

    return nearby