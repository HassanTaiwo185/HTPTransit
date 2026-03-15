from fastapi import APIRouter, HTTPException
from app.services.stops_service import get_nearby_stops

router = APIRouter(tags=["nearby"])

# Changed path from "/nearby" to "/stops/nearby" to match your frontend calls
@router.get("/stops/nearby")
def get_nearby(lat: float, lon: float, radius_km: float = 0.5):
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    if not (0.1 <= radius_km <= 5.0):
        raise HTTPException(status_code=400, detail="radius_km must be between 0.1 and 5.0")

    stops = get_nearby_stops(lat, lon, radius_km=radius_km)

    if not stops:
        raise HTTPException(
            status_code=404,
            detail={"error": "no_stops_found", "message": "No stops found in this area."}
        )

    return {
        "lat": lat,
        "lon": lon,
        "radius_km": radius_km,
        "count": len(stops),
        "stops": stops
    }