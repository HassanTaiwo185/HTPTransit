from fastapi import APIRouter
from app.services.vehicles_service import get_vehicle_positions

router = APIRouter()

@router.get("/route/{global_route_id}/vehicles")
async def vehicles(global_route_id: str, direction_id: int = None):
    return await get_vehicle_positions(global_route_id, direction_id)