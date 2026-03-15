from fastapi import APIRouter, HTTPException
from app.data import store

router = APIRouter(tags=["trip"])

@router.get("/trip/{trip_id}/stops")
def get_trip_stops(trip_id: str):

    stops = store.trip_to_stops.get(trip_id)

    if not stops:
        raise HTTPException(status_code=404, detail="Trip not found")

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
        "trip_id": trip_id,
        "stops": result,
        "total_stops": len(result)
    }