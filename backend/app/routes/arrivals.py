from fastapi import APIRouter, HTTPException
from app.services.arrivals_service import get_next_arrivals

router = APIRouter(tags=["arrivals"])

# Changed from "/arrivals/{stop_id}" to "/stop/{stop_id}/arrivals"
@router.get("/stop/{stop_id}/arrivals")
def get_arrivals(stop_id: str, limit: int = 5):
    if not stop_id or not stop_id.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "invalid_stop_id",
                "message": "Stop ID cannot be empty"
            }
        )
        
    result = get_next_arrivals(stop_id, limit=limit)
    
    if "error" in result:
        raise HTTPException(
            status_code=404,
            detail={
                "error":   "stop_not_found",
                "message": f"Stop {stop_id} does not exist in Durham Transit"
            }
        )
    return result