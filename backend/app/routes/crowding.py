from fastapi import APIRouter, Query
from app.services.crowding_service import get_predicted_crowding
from app.data import store

router = APIRouter()

@router.get("/predict/crowding/trip")
async def predict_trip_crowding(
    stop_id:      str = Query(...),
    departure_ts: int = Query(...),
):
    """ML crowding prediction for a future/scheduled trip."""
    stop = store.stop_info.get(stop_id, {})
    return get_predicted_crowding(
        stop_lat     = stop.get("stop_lat"),
        stop_lon     = stop.get("stop_lon"),
        departure_ts = departure_ts,
        route_count  = stop.get("route_count", 1),

    )
