"""
arrivals_service.py — next scheduled arrivals at a stop.
Uses stop_to_arrivals, stop_to_trips and trip_info from memory.
"""
import logging
from datetime import datetime, timedelta
from app.data import store

logger = logging.getLogger(__name__)


def _parse_time(time_str: str) -> datetime:
    """
    GTFS times can go past 24:00 (e.g. 25:30:00 for next day).
    We normalize them to a real datetime for comparison.
    """
    now = datetime.now()
    h, m, s = map(int, time_str.split(":"))
    base = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return base + timedelta(hours=h, minutes=m, seconds=s)


def get_next_arrivals(stop_id: str, limit: int = 5) -> dict:
    """
    Returns the next `limit` arrivals at a given stop.
    """
    if stop_id not in store.stop_info:
        return {"error": f"Stop {stop_id} not found"}

    now = datetime.now()

    arrivals = store.stop_to_arrivals.get(stop_id, [])
    trips    = store.stop_to_trips.get(stop_id, [])

    if not arrivals:
        return {"stop_id": stop_id, "arrivals": []}

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

        # format stop time as 12hr e.g. "2:32 PM"
        h, m, s   = map(int, arrival_str.split(":"))
        display_h = h % 24
        period    = "AM" if display_h < 12 else "PM"
        display_h = display_h % 12 or 12
        stop_time = f"{display_h}:{m:02d} {period}"

        # route color with fallback to grey
        route_color      = route.get("route_color", "888888") or "888888"
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
            "stop_time":        stop_time,        # ← "2:32 PM"
            "arrives_in_min":   round((arrival_time - now).seconds / 60, 1)
        })

    upcoming.sort(key=lambda x: x["arrives_in_min"])

    stop = store.stop_info.get(stop_id, {})

    return {
        "stop_id":   stop_id,
        "stop_name": stop.get("stop_name", ""),
        "stop_lat":  stop.get("stop_lat"),
        "stop_lon":  stop.get("stop_lon"),
        "arrivals":  upcoming[:limit]
    }