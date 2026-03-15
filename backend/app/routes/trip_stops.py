from fastapi import APIRouter, HTTPException
from app.data import store
from datetime import datetime
import logging

router = APIRouter(tags=["trips"])
logger = logging.getLogger(__name__)


def _clean_trip_id(trip_id: str) -> str:
    """Strip namespace prefix e.g. 'DRTON:12345' → '12345'."""
    if ":" in trip_id:
        return trip_id.split(":", 1)[1]
    return trip_id


@router.get("/trips/{trip_id}/stops")
def get_trip_stops(trip_id: str, departure_ts: int = None):
    clean_id = _clean_trip_id(trip_id)
    resolved = trip_id if store.trip_to_stops.get(trip_id) else clean_id

    # ── DIAGNOSTIC LOG — remove once working ──────────────────────────────
    sample = list(store.trip_to_stops.keys())[:5]
    logger.info(
        "TRIP STOPS: raw=%r  clean=%r  resolved=%r  found=%s  store_sample=%s",
        trip_id, clean_id, resolved,
        bool(store.trip_to_stops.get(resolved)),
        sample,
    )
    # ──────────────────────────────────────────────────────────────────────

    stops = store.trip_to_stops.get(resolved, [])
    if not stops:
        raise HTTPException(
            status_code=404,
            detail={
                "error":   "trip_not_found",
                "message": f"Trip {trip_id} not found"
            }
        )

    result = []
    first_gtfs_minutes = None

    for stop_id in stops:
        stop_info    = store.stop_info.get(stop_id, {})
        arrivals     = store.stop_to_arrivals.get(stop_id, [])
        trip_ids     = store.stop_to_trips.get(stop_id, [])
        arrival_time = None

        for t_id, arr in zip(trip_ids, arrivals):
            if t_id == resolved:
                arrival_time = arr
                break

        stop_time = None
        if arrival_time and departure_ts:
            try:
                parts = arrival_time.split(":")
                h = int(parts[0])
                m = int(parts[1])
                gtfs_minutes = h * 60 + m

                if first_gtfs_minutes is None:
                    first_gtfs_minutes = gtfs_minutes
                    offset_minutes     = 0
                else:
                    offset_minutes = gtfs_minutes - first_gtfs_minutes

                real_ts   = departure_ts + (offset_minutes * 60)
                dt        = datetime.fromtimestamp(real_ts)
                stop_time = dt.strftime("%-I:%M %p")
            except Exception:
                stop_time = arrival_time
        elif arrival_time:
            try:
                h, m, s   = map(int, arrival_time.split(":"))
                display_h = h % 24
                period    = "AM" if display_h < 12 else "PM"
                display_h = display_h % 12 or 12
                stop_time = f"{display_h}:{m:02d} {period}"
            except Exception:
                stop_time = arrival_time

        result.append({
            "stop_id":      stop_id,
            "stop_name":    stop_info.get("stop_name", ""),
            "stop_lat":     stop_info.get("stop_lat"),
            "stop_lon":     stop_info.get("stop_lon"),
            "arrival_time": arrival_time,
            "stop_time":    stop_time,
            "sequence":     store.stop_trip_sequence.get((stop_id, resolved), 0),
        })

    result.sort(key=lambda x: x["sequence"])
    trip  = store.trip_info.get(resolved, {})
    route = store.route_info.get(trip.get("route_id", ""), {})

    return {
        "trip_id":          resolved,
        "route_id":         trip.get("route_id", ""),
        "route_short_name": route.get("route_short_name", ""),
        "headsign":         trip.get("trip_headsign", ""),
        "stops":            result,
        "total_stops":      len(result),
    }