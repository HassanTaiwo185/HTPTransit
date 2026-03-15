"""
arrivals_service.py — next arrivals at a stop.

The Transit API's nearby_routes returns itineraries with schedule_items.
Each itinerary = one route+direction. The schedule_items are the next
departures in order. We take the first as the arrival shown in ArrivalSheet,
and the next 2 as next_departures so RouteStopSheet can show real times.
"""
import httpx
import logging
from datetime import datetime, timedelta

from app.core.config import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter
from app.data import store

logger = logging.getLogger(__name__)


def _parse_time(time_str: str) -> datetime:
    now  = datetime.now()
    h, m, s = map(int, time_str.split(":"))
    base = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return base + timedelta(hours=h, minutes=m, seconds=s)


def _format_stop_time(arrival_str: str) -> str:
    h, m, s   = map(int, arrival_str.split(":"))
    display_h = h % 24
    period    = "AM" if display_h < 12 else "PM"
    display_h = display_h % 12 or 12
    return f"{display_h}:{m:02d} {period}"


def _static_arrivals(stop_id: str, limit: int, now: datetime) -> list:
    """Build arrivals from static GTFS — no next_departures available."""
    arrivals = store.stop_to_arrivals.get(stop_id, [])
    trips    = store.stop_to_trips.get(stop_id, [])
    upcoming = []

    for trip_id, arrival_str in zip(trips, arrivals):
        try:
            arrival_time = _parse_time(arrival_str)
        except ValueError:
            continue
        if arrival_time < now:
            continue

        trip  = store.trip_info.get(trip_id, {})
        route = store.route_info.get(trip.get("route_id", ""), {})
        route_color      = route.get("route_color",      "888888") or "888888"
        route_text_color = route.get("route_text_color", "ffffff") or "ffffff"

        upcoming.append({
            "trip_id":          trip_id,
            "route_id":         trip.get("route_id", ""),
            "route_short_name": route.get("route_short_name", ""),
            "route_long_name":  route.get("route_long_name", ""),
            "route_color":      f"#{route_color}",
            "route_text_color": f"#{route_text_color}",
            "headsign":         trip.get("trip_headsign", ""),
            "arrival_time":     arrival_str,
            "stop_time":        _format_stop_time(arrival_str),
            "arrives_in_min":   round((arrival_time - now).total_seconds() / 60, 1),
            "is_real_time":     False,
            "global_route_id":  None,
            "next_departures":  [],   # no next deps from static data
        })

    upcoming.sort(key=lambda x: x["arrives_in_min"])
    return upcoming[:limit]



def _find_gtfs_trip_id(route_short_name: str, departure_timestamp: int) -> str:
    """Match a Transit API departure to a GTFS trip_id by route + time."""
    if not departure_timestamp:
        return ""
    dt = datetime.fromtimestamp(departure_timestamp)
    target_minutes = dt.hour * 60 + dt.minute
    best_trip_id = ""
    best_diff = 9999
    for rid, rinfo in store.route_info.items():
        if rinfo.get("route_short_name") != route_short_name:
            continue
        for tid, tinfo in store.trip_info.items():
            if tinfo.get("route_id") != rid:
                continue
            stops = store.trip_to_stops.get(tid, [])
            if not stops:
                continue
            arrivals = store.stop_to_arrivals.get(stops[0], [])
            trip_ids = store.stop_to_trips.get(stops[0], [])
            for t_id, arr in zip(trip_ids, arrivals):
                if t_id != tid:
                    continue
                try:
                    parts = arr.split(":")
                    h = int(parts[0]) % 24
                    m = int(parts[1])
                    diff = abs(h * 60 + m - target_minutes)
                    if diff < best_diff:
                        best_diff = diff
                        best_trip_id = tid
                except Exception:
                    pass
    return best_trip_id if best_diff < 10 else ""


async def get_next_arrivals(stop_id: str, limit: int = 3) -> dict:
    if stop_id not in store.stop_info:
        return {"error": f"Stop {stop_id} not found"}

    now  = datetime.now()
    stop = store.stop_info[stop_id]

    try:
        await transit_limiter.acquire()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TRANSIT_BASE_URL}/nearby_routes",
                headers={"apiKey": TRANSIT_API_KEY},
                params={
                    "lat":          stop["stop_lat"],
                    "lon":          stop["stop_lon"],
                    "max_distance": 200,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        upcoming = []

        for route in data.get("routes", []):
            global_route_id  = route.get("global_route_id")
            route_short_name = route.get("route_short_name", "")
            route_long_name  = route.get("route_long_name", "")
            route_color      = f"#{route.get('route_color', '888888') or '888888'}"
            route_text_color = f"#{route.get('route_text_color', 'ffffff') or 'ffffff'}"

            for itin in route.get("itineraries", []):
                headsign      = itin.get("headsign", "")
                schedule_items = [
                    s for s in itin.get("schedule_items", [])
                    if s.get("departure_time") and
                       (datetime.fromtimestamp(s["departure_time"]) - now).total_seconds() >= 0
                ]

                if not schedule_items:
                    continue

                # First item = the arrival we show in ArrivalSheet
                first = schedule_items[0]
                dep_dt      = datetime.fromtimestamp(first["departure_time"])
                arrives_min = round((dep_dt - now).total_seconds() / 60, 1)

                # Next 2 items = next_departures shown in RouteStopSheet
                next_deps = []
                for s in schedule_items[1:3]:
                    s_dt = datetime.fromtimestamp(s["departure_time"])
                    next_deps.append({
                        "start_time":  s["departure_time"],
                        "is_real_time": s.get("is_real_time", False),
                        "arrives_in_min": round((s_dt - now).total_seconds() / 60, 1),
                    })

                # look up GTFS trip_id by route + departure minute
                gtfs_trip_id = _find_gtfs_trip_id(route_short_name, first["departure_time"])

                upcoming.append({
                    "trip_id":          gtfs_trip_id,
                    "route_id":         "",
                    "route_short_name": route_short_name,
                    "route_long_name":  route_long_name,
                    "route_color":      route_color,
                    "route_text_color": route_text_color,
                    "headsign":         headsign,
                    "arrival_time":     dep_dt.strftime("%H:%M:%S"),
                    "stop_time":        dep_dt.strftime("%-I:%M %p"),
                    "arrives_in_min":   arrives_min,
                    "is_real_time":     first.get("is_real_time", False),
                    "global_route_id":  global_route_id,
                    "next_departures":  next_deps,   # ← real times from API
                })

        upcoming.sort(key=lambda x: x["arrives_in_min"])
        upcoming = upcoming[:limit]

        if not upcoming:
            upcoming = _static_arrivals(stop_id, limit, now)

        logger.info(
            "Arrivals for stop %s: %d results, next_departures sample: %s",
            stop_id, len(upcoming),
            [len(a.get("next_departures", [])) for a in upcoming],
        )

    except Exception as e:
        logger.warning("Live arrivals failed for stop %s, using static: %s", stop_id, e)
        upcoming = _static_arrivals(stop_id, limit, now)

    return {
        "stop_id":   stop_id,
        "stop_name": stop.get("stop_name", ""),
        "stop_lat":  stop.get("stop_lat"),
        "stop_lon":  stop.get("stop_lon"),
        "arrivals":  upcoming,
    }