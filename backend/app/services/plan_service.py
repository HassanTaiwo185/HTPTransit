"""
plan_service.py
"""
import httpx
import logging
from datetime import datetime

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter
from app.data import store

logger = logging.getLogger(__name__)


def _find_trip_id_for_route(route_short_name, departure_timestamp=None):
    target_minutes = None
    if departure_timestamp:
        dt = datetime.fromtimestamp(departure_timestamp)
        target_minutes = dt.hour * 60 + dt.minute
    best_trip_id = None
    best_diff = 9999
    for rid, rinfo in store.route_info.items():
        if rinfo.get("route_short_name") == route_short_name:
            for tid, tinfo in store.trip_info.items():
                if tinfo.get("route_id") == rid:
                    if target_minutes is None:
                        return tid
                    stops = store.trip_to_stops.get(tid, [])
                    if stops:
                        arrivals = store.stop_to_arrivals.get(stops[0], [])
                        trip_ids = store.stop_to_trips.get(stops[0], [])
                        for t_id, arr in zip(trip_ids, arrivals):
                            if t_id == tid:
                                try:
                                    parts = arr.split(":")
                                    h = int(parts[0]) % 24
                                    m = int(parts[1])
                                    trip_minutes = h * 60 + m
                                    diff = abs(trip_minutes - target_minutes)
                                    if diff < best_diff:
                                        best_diff = diff
                                        best_trip_id = tid
                                except Exception:
                                    pass
    return best_trip_id


def _format_timestamp(ts):
    if not ts:
        return None
    return datetime.fromtimestamp(ts).strftime("%-I:%M %p")


async def get_plan(from_lat, from_lon, to_lat, to_lon,
                   mode="transit", num_results=3,
                   departure_time: int | None = None):

    params = {
        "from_lat":               from_lat,
        "from_lon":               from_lon,
        "to_lat":                 to_lat,
        "to_lon":                 to_lon,
        "mode":                   mode,
        "num_result":             num_results,
        "should_update_realtime": True,
    }

    # The API uses `leave_time` for a requested departure timestamp.
    # When this is a future time the API naturally returns is_real_time=False
    # on each leg — no extra logic needed on our side.
    if departure_time is not None:
        params["leave_time"] = departure_time

    await transit_limiter.acquire()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{TRANSIT_BASE_URL}/plan",
            headers={"apiKey": TRANSIT_API_KEY},
            params=params,
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    plans = []
    for result in data.get("results", []):
        legs = []
        for leg in result.get("legs", []):
            route           = None
            global_route_id = None
            headsign        = None
            trip_id         = None
            is_real_time    = False
            stop_times      = []

            if leg.get("leg_mode") == "transit":
                routes = leg.get("routes", [])
                if routes:
                    route           = routes[0].get("route_short_name", "")
                    global_route_id = routes[0].get("global_route_id", "")

                departures = leg.get("departures", [])
                if departures:
                    departure    = departures[0]
                    # Trust the API — it sets is_real_time=False for future trips
                    is_real_time = departure.get("is_real_time", False)

                    plan_details = departure.get("plan_details", {})
                    arrival_item = plan_details.get("arrival_schedule_item", {})
                    headsign     = arrival_item.get("trip_headsign")

                    for item in plan_details.get("stop_schedule_items", []):
                        arrival_ts = item.get("arrival_time")
                        stop_times.append({
                            "global_stop_id": item.get("global_stop_id", ""),
                            "arrival_time":   arrival_ts,
                            "stop_time":      _format_timestamp(arrival_ts),
                            "is_real_time":   item.get("is_real_time", False),
                            "is_cancelled":   item.get("is_cancelled", False),
                        })

                if route:
                    trip_id = _find_trip_id_for_route(route, leg.get("start_time"))

            legs.append({
                "mode":            leg.get("leg_mode"),
                "distance_m":      round(leg.get("distance", 0), 1),
                "duration_min":    round(leg.get("duration", 0) / 60, 1),
                "start_time":      leg.get("start_time"),
                "end_time":        leg.get("end_time"),
                "route":           route,
                "global_route_id": global_route_id,
                "trip_id":         trip_id,
                "headsign":        headsign,
                "is_real_time":    is_real_time,
                "polyline":        leg.get("polyline", ""),
                "stop_times":      stop_times,
            })

        plans.append({
            "duration_min": round(result.get("duration", 0) / 60, 1),
            "start_time":   result.get("start_time"),
            "end_time":     result.get("end_time"),
            "legs":         legs,
        })

    route_ids = list({
        leg["global_route_id"]
        for plan in plans
        for leg in plan["legs"]
        if leg.get("global_route_id")
    })

    logger.info("Fetched %d plans (leave_time=%s), route_ids: %s",
                len(plans), departure_time, route_ids)

    return {
        "from":      {"lat": from_lat, "lon": from_lon},
        "to":        {"lat": to_lat,   "lon": to_lon},
        "plans":     plans,
        "route_ids": route_ids,
    }