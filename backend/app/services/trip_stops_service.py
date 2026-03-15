"""
trip_stops_service.py — return stop sequence for a transit trip.
Uses GTFS stop_times already loaded in memory.
"""

import logging
from app.data import store

logger = logging.getLogger(__name__)


async def get_trip_stops(trip_id: str) -> dict:
    """
    Returns ordered stops for a given trip_id.
    """

    if trip_id not in store.trip_stop_times:
        logger.warning("Trip %s not found in stop_times", trip_id)
        return {"stops": []}

    stop_times = store.trip_stop_times[trip_id]

    stops = []

    for stop_time in stop_times:

        stop_id = stop_time["stop_id"]

        if stop_id not in store.stop_info:
            continue

        stop_info = store.stop_info[stop_id]

        stops.append({
            "stop_id": stop_id,
            "stop_name": stop_info["stop_name"],
            "stop_lat": stop_info["stop_lat"],
            "stop_lon": stop_info["stop_lon"],
            "stop_time": stop_time.get("arrival_time")
        })

    logger.info("Returned %d stops for trip %s", len(stops), trip_id)

    return {"stops": stops}