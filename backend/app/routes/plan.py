from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.plan_service import get_plan
from app.core.limiter import RateLimitExceeded

router = APIRouter(tags=["plan"])


class PlanRequest(BaseModel):
    from_lat:       float
    from_lon:       float
    to_lat:         float
    to_lon:         float
    mode:           str           = "transit"
    num_results:    int           = 3
    departure_time: Optional[int] = None   # unix timestamp, None = leave now


@router.post("/plan")
async def plan_trip(req: PlanRequest):
    if req.from_lat == req.to_lat and req.from_lon == req.to_lon:
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "same_origin_destination",
                "message": "Origin and destination cannot be the same location"
            }
        )

    try:
        result = await get_plan(
            from_lat       = req.from_lat,
            from_lon       = req.from_lon,
            to_lat         = req.to_lat,
            to_lon         = req.to_lon,
            mode           = req.mode,
            num_results    = req.num_results,
            departure_time = req.departure_time,   # ← now forwarded
        )

        if not result.get("plans"):
            raise HTTPException(
                status_code=404,
                detail={
                    "error":   "no_plans_found",
                    "message": "No transit plans found for this route"
                }
            )

        return result

    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error":   "rate_limit_exceeded",
                "message": str(e)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error":   "plan_failed",
                "message": "Trip planning failed. Please try again."
            }
        )