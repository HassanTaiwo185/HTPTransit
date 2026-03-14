"""
vehicles_service.py — fetch live vehicle positions from Transit API.
"""
import httpx
import logging

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter

logger = logging.getLogger(__name__)


async def get_vehicle_positions(global_route_id: str, direction_id: int = None) -> dict:
    await transit_limiter.acquire()

    params = {"global_route_id": global_route_id}
    if direction_id is not None:
        params["direction_id"] = direction_id

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{TRANSIT_BASE_URL}/vehicles",
            headers={"apiKey": TRANSIT_API_KEY},
            params=params,
            timeout=10.0
        )

        # vehicles endpoint not available on this API tier
        if response.status_code == 404:
            logger.warning("Vehicles endpoint not available for route %s", global_route_id)
            return {"route_id": global_route_id, "vehicles": [], "available": False}

        response.raise_for_status()
        data = response.json()

    vehicles = []
    for v in data.get("vehicles", []):
        vehicles.append({
            "vehicle_id":            v.get("vehicle_id"),
            "label":                 v.get("vehicle_label"),
            "latitude":              v.get("latitude"),
            "longitude":             v.get("longitude"),
            "direction_id":          v.get("direction_id"),
            "occupancy_status":      v.get("occupancy_status"),
            "wheelchair_accessible": v.get("wheelchair_accessible"),
            "rt_trip_id":            v.get("rt_trip_id"),
            "updated_at":            v.get("updated_at"),
        })

    logger.info("Fetched %d vehicles for route %s", len(vehicles), global_route_id)
    return {"route_id": global_route_id, "vehicles": vehicles, "available": True}