"""
plan_service.py — trip planning from origin to destination.
"""
import httpx
import logging

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter

logger = logging.getLogger(__name__)


async def get_plan(
    from_lat: float,
    from_lon: float,
    to_lat:   float,
    to_lon:   float,
    mode:     str = "transit",
    num_results: int = 3
) -> dict:
    await transit_limiter.acquire()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{TRANSIT_BASE_URL}/plan",
            headers={"apiKey": TRANSIT_API_KEY},
            params={
                "from_lat":               from_lat,
                "from_lon":               from_lon,
                "to_lat":                 to_lat,
                "to_lon":                 to_lon,
                "mode":                   mode,
                "num_result":             num_results,
                "should_update_realtime": True,
            },
            timeout=15.0
        )
        response.raise_for_status()
        data = response.json()

    plans = []
    for result in data.get("results", []):
        legs = []
        for leg in result.get("legs", []):
            route            = None
            global_route_id  = None
            headsign         = None
            is_real_time     = False

            if leg.get("leg_mode") == "transit":
                # route info is in leg -> routes[0]
                routes = leg.get("routes", [])
                if routes:
                    route           = routes[0].get("route_short_name", "")
                    global_route_id = routes[0].get("global_route_id", "")

                # real-time info is in leg -> departures[0]
                departures = leg.get("departures", [])
                if departures:
                    is_real_time = departures[0].get("is_real_time", False)
                    headsign     = (
                        departures[0]
                        .get("plan_details", {})
                        .get("arrival_schedule_item", {})
                        .get("trip_headsign", "")
                    )

            legs.append({
                "mode":            leg.get("leg_mode"),
                "distance_m":      round(leg.get("distance", 0), 1),
                "duration_min":    round(leg.get("duration", 0) / 60, 1),
                "start_time":      leg.get("start_time"),
                "end_time":        leg.get("end_time"),
                "route":           route,
                "global_route_id": global_route_id,
                "headsign":        headsign,
                "is_real_time":    is_real_time,
                "polyline":        leg.get("polyline", ""),
            })

        plans.append({
            "duration_min": round(result.get("duration", 0) / 60, 1),
            "start_time":   result.get("start_time"),
            "end_time":     result.get("end_time"),
            "legs":         legs,
        })

    # collect unique global_route_ids for vehicles lookup
    route_ids = list({
        leg["global_route_id"]
        for plan in plans
        for leg in plan["legs"]
        if leg.get("global_route_id")
    })

    logger.info("Fetched %d plans, route_ids: %s", len(plans), route_ids)

    return {
        "from":      {"lat": from_lat, "lon": from_lon},
        "to":        {"lat": to_lat,   "lon": to_lon},
        "plans":     plans,
        "route_ids": route_ids
    }