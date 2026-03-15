from fastapi import APIRouter, HTTPException
from app.data import store
from datetime import datetime, timedelta

router = APIRouter(tags=["trips"])

@router.get("/trips/{trip_id}/stops")
def get_trip_stops(trip_id: str, start_time: int = None):
    stops = store.trip_to_stops.get(trip_id, [])
    if not stops:
        raise HTTPException(status_code=404, detail={"error": "trip_not_found", "message": f"Trip {trip_id} not found"})

    result = []
    first_gtfs_minutes = None

    for stop_id in stops:
        stop_info    = store.stop_info.get(stop_id, {})
        arrivals     = store.stop_to_arrivals.get(stop_id, [])
        trip_ids     = store.stop_to_trips.get(stop_id, [])
        arrival_time = None

        for t_id, arr in zip(trip_ids, arrivals):
            if t_id == trip_id:
                arrival_time = arr
                break

        stop_time = None
        if arrival_time and start_time:
            try:
                parts = arrival_time.split(":")
                h = int(parts[0])
                m = int(parts[1])
                s = int(parts[2])
                gtfs_minutes = h * 60 + m

                if first_gtfs_minutes is None:
                    first_gtfs_minutes = gtfs_minutes
                    offset_minutes = 0
                else:
                    offset_minutes = gtfs_minutes - first_gtfs_minutes

                real_ts = start_time + (offset_minutes * 60)
                dt = datetime.fromtimestamp(real_ts)
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
            "sequence":     store.stop_trip_sequence.get((stop_id, trip_id), 0),
        })

    result.sort(key=lambda x: x["sequence"])
    trip  = store.trip_info.get(trip_id, {})
    route = store.route_info.get(trip.get("route_id", ""), {})

    return {
        "trip_id":          trip_id,
        "route_id":         trip.get("route_id", ""),
        "route_short_name": route.get("route_short_name", ""),
        "headsign":         trip.get("trip_headsign", ""),
        "stops":            result,
        "total_stops":      len(result),
    }
