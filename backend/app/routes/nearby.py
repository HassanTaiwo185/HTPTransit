from fastapi import APIRouter, HTTPException
from app.services.stops_service import get_nearby_stops

router = APIRouter(tags=["nearby"])


@router.get("/nearby")
def get_nearby(lat: float, lon: float, radius_km: float = 0.5):
    if not (-90 <= lat <= 90):
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_latitude",
                "message": "Latitude must be between -90 and 90"
            }
        )
    if not (-180 <= lon <= 180):
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_longitude",
                "message": "Longitude must be between -180 and 180"
            }
        )
    if not (0.1 <= radius_km <= 5.0):
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_radius",
                "message": "radius_km must be between 0.1 and 5.0"
            }
        )

    stops = get_nearby_stops(lat, lon, radius_km=radius_km)

    if not stops:
        raise HTTPException(
            status_code=404,
            detail={
                "error":   "no_stops_found",
                "message": f"No Durham Transit stops found within {radius_km}km of ({lat}, {lon})"
            }
        )

    return {
        "lat":       lat,
        "lon":       lon,
        "radius_km": radius_km,
        "count":     len(stops),
        "stops":     stops
    }