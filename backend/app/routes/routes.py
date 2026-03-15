from fastapi import APIRouter, HTTPException
from app.data import store

router = APIRouter(tags=["routes"])


@router.get("/route/{route_id}/stops")
def get_route_stops(route_id: str):

    trips = [
        trip_id
        for trip_id, trip in store.trip_info.items()
        if trip["route_id"] == route_id
    ]

    if not trips:
        raise HTTPException(status_code=404, detail="Route not found")

    # choose first trip pattern
    trip_id = trips[0]

    stops = store.trip_to_stops.get(trip_id, [])

    result = []

    for stop_id in stops:

        info = store.stop_info.get(stop_id, {})

        result.append({
            "stop_id": stop_id,
            "stop_name": info.get("stop_name"),
            "stop_lat": info.get("stop_lat"),
            "stop_lon": info.get("stop_lon"),
        })

    return {
        "route_id": route_id,
        "stops": result,
        "total_stops": len(result)
    }