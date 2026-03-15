from fastapi import APIRouter, HTTPException
from app.data import store
from datetime import datetime
import logging

router = APIRouter(tags=["trips"])
logger = logging.getLogger(__name__)


def _find_by_route_and_time(route_short_name: str, departure_ts: int) -> str | None:
    if not route_short_name or not departure_ts:
        return None
    dt             = datetime.fromtimestamp(departure_ts)
    target_minutes = dt.hour * 60 + dt.minute
    best_id, best_diff = None, 9999

    for rid, rinfo in store.route_info.items():
        if rinfo.get("route_short_name") != route_short_name:
            continue
        for tid in store.trip_info:
            if store.trip_info[tid].get("route_id") != rid:
                continue
            stop_ids = store.trip_to_stops.get(tid, [])
            if not stop_ids:
                continue
            first = stop_ids[0]
            for t_id, arr in zip(store.stop_to_trips.get(first, []), store.stop_to_arrivals.get(first, [])):
                if t_id != tid:
                    continue
                try:
                    h, m, _ = map(int, arr.split(":"))
                    diff = abs((h % 24) * 60 + m - target_minutes)
                    if diff < best_diff:
                        best_diff, best_id = diff, tid
                except Exception:
                    pass

    logger.info("route+time match: route=%r ts=%s target=%d best_diff=%d id=%r",
                route_short_name, departure_ts, target_minutes, best_diff, best_id)
    return best_id if best_diff <= 10 else None


@router.get("/trips/{trip_id}/stops")
def get_trip_stops(trip_id: str, departure_ts: int = None, route: str = None):

    resolved = None

    if route and departure_ts:
        resolved = _find_by_route_and_time(route, departure_ts)

    if not resolved:
        clean    = trip_id.split(":", 1)[1] if ":" in trip_id else trip_id
        resolved = trip_id if store.trip_to_stops.get(trip_id) else \
                   clean   if store.trip_to_stops.get(clean)   else None

    logger.info("TRIPS: raw=%r route=%r ts=%s → resolved=%r found=%s",
                trip_id, route, departure_ts, resolved, bool(resolved))

    if not resolved:
        raise HTTPException(status_code=404, detail={"error": "trip_not_found", "message": f"Trip {trip_id} not found"})

    stops = store.trip_to_stops.get(resolved, [])
    if not stops:
        raise HTTPException(status_code=404, detail={"error": "trip_not_found", "message": f"Trip {resolved} not found"})

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
                h = int(arrival_time.split(":")[0])
                m = int(arrival_time.split(":")[1])
                gtfs_minutes = h * 60 + m
                if first_gtfs_minutes is None:
                    first_gtfs_minutes = gtfs_minutes
                    offset_minutes = 0
                else:
                    offset_minutes = gtfs_minutes - first_gtfs_minutes
                dt        = datetime.fromtimestamp(departure_ts + offset_minutes * 60)
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
    trip       = store.trip_info.get(resolved, {})
    route_info = store.route_info.get(trip.get("route_id", ""), {})

    return {
        "trip_id":          resolved,
        "route_id":         trip.get("route_id", ""),
        "route_short_name": route_info.get("route_short_name", ""),
        "headsign":         trip.get("trip_headsign", ""),
        "stops":            result,
        "total_stops":      len(result),
    }
