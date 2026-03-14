"""
trips_service.py — fetch real-time trip updates from Transit API.
"""
import httpx
import logging

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter
from app.data import store

logger = logging.getLogger(__name__)


async def get_trip_updates(stop_id: str) -> dict:
    """
    Returns real-time trip updates for a given stop.
    Enriches with static schedule data already in memory.
    """
    if stop_id not in store.stop_info:
        return {"error": f"Stop {stop_id} not found"}

    await transit_limiter.acquire()

    stop = store.stop_info[stop_id]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{TRANSIT_BASE_URL}/nearby_routes",
            headers={"apiKey": TRANSIT_API_KEY},
            params={
                "lat":          stop["stop_lat"],
                "lon":          stop["stop_lon"],
                "max_distance": 200,
            },
            timeout=10.0
        )
        response.raise_for_status()
        data = response.json()

    routes = []
    for route in data.get("routes", []):
        routes.append({
            "global_route_id":    route.get("global_route_id"),
            "route_short_name":   route.get("route_short_name"),
            "route_long_name":    route.get("route_long_name"),
            "real_time_arrivals": route.get("itineraries", []),
        })

    logger.info("Fetched %d route updates for stop %s", len(routes), stop_id)

    return {
        "stop_id":   stop_id,
        "stop_name": stop["stop_name"],
        "routes":    routes
    }