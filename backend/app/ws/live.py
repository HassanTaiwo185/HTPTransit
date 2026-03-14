"""
live.py — WS /ws/live/{stop_id}
Pushes live updates every 30s:
  - next arrivals (static GTFS)
  - real-time trip updates (Transit API)
  - ML crowding prediction
  - bus approaching / prepare to exit notifications
"""
import json
import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.arrivals_service import get_next_arrivals
from app.services.trips_service    import get_trip_updates
from app.ml.predictor              import predict
from app.data                      import store
from app.core.limiter              import RateLimitExceeded

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

PUSH_INTERVAL = 30   # seconds between updates


def _get_stop_sequence(trip_id: str, stop_id: str) -> int:
    """Get sequence number of a stop on a trip."""
    return store.stop_trip_sequence.get((stop_id, trip_id), -1)


def _check_notifications(
    arrivals:         dict,
    origin_stop_id:   str,
    dest_stop_id:     str = None,
) -> list:
    """
    Check if any buses are approaching origin or destination.
    Returns list of notification dicts.
    """
    notifications = []

    if not arrivals.get("arrivals"):
        return notifications

    for arrival in arrivals["arrivals"]:
        trip_id       = arrival.get("trip_id", "")
        arrives_in    = arrival.get("arrives_in_min", 999)
        route_name    = arrival.get("route_short_name", "Bus")
        stop_time     = arrival.get("stop_time", "")

        # ── bus approaching origin ────────────────────────────
        if arrives_in <= 5:
            notifications.append({
                "type":    "bus_approaching",
                "message": f"Bus {route_name} arriving at {stop_time} — head to stop now!",
                "trip_id": trip_id,
                "arrives_in_min": arrives_in,
                "action":  "head_to_stop",
            })

        # ── bus approaching destination ───────────────────────
        if dest_stop_id:
            origin_seq = _get_stop_sequence(trip_id, origin_stop_id)
            dest_seq   = _get_stop_sequence(trip_id, dest_stop_id)

            if origin_seq != -1 and dest_seq != -1 and dest_seq > origin_seq:
                stops_away = dest_seq - origin_seq

                if stops_away <= 2:
                    notifications.append({
                        "type":      "prepare_to_exit",
                        "message":   f"Your stop is {stops_away} stop(s) away — prepare to exit!",
                        "trip_id":   trip_id,
                        "stops_away": stops_away,
                        "action":    "prepare_exit",
                    })

                if stops_away == 0:
                    notifications.append({
                        "type":    "arrived_at_destination",
                        "message": "You have arrived at your destination!",
                        "trip_id": trip_id,
                        "action":  "exit_now",
                    })

    return notifications


@router.websocket("/ws/live/{stop_id}")
async def live_stop(
    websocket: WebSocket,
    stop_id:   str,
    dest_stop_id: str = None,   # optional destination stop
):
    await websocket.accept()
    logger.info("WS connected: stop %s → dest %s", stop_id, dest_stop_id)

    # send immediate welcome message
    await websocket.send_text(json.dumps({
        "type":          "connected",
        "stop_id":       stop_id,
        "dest_stop_id":  dest_stop_id,
        "message":       "Connected to live updates",
        "push_interval": PUSH_INTERVAL,
    }))

    try:
        while True:
            now        = datetime.now()
            hour       = now.hour
            is_weekend = int(now.weekday() >= 5)

            # ── static arrivals from GTFS memory ──────────────
            arrivals = get_next_arrivals(stop_id, limit=5)

            # ── real-time trip updates from Transit API ────────
            try:
                trips = await get_trip_updates(stop_id)
            except RateLimitExceeded:
                trips = {"error": "rate_limit_exceeded", "routes": []}
            except Exception as e:
                logger.warning("Trip update failed for %s: %s", stop_id, e)
                trips = {"error": str(e), "routes": []}

            # ── ML crowding prediction ─────────────────────────
            stop     = store.stop_info.get(stop_id, {})
            stop_lat = stop.get("stop_lat")
            stop_lon = stop.get("stop_lon")

            # estimate boardings based on time of day
            if 7 <= hour <= 9 or 16 <= hour <= 19:
                boardings, alightings = 150.0, 80.0    # peak
            elif 22 <= hour or hour <= 5:
                boardings, alightings = 10.0, 5.0      # night
            else:
                boardings, alightings = 50.0, 25.0     # off peak

            crowding = predict(
                boardings  = boardings,
                alightings = alightings,
                stop_lat   = stop_lat,
                stop_lon   = stop_lon,
                hour       = hour,
                is_weekend = is_weekend,
            )

            # ── notifications ──────────────────────────────────
            notifications = _check_notifications(
                arrivals       = arrivals,
                origin_stop_id = stop_id,
                dest_stop_id   = dest_stop_id,
            )

            # ── push combined update ───────────────────────────
            payload = {
                "type":           "live_update",
                "stop_id":        stop_id,
                "dest_stop_id":   dest_stop_id,
                "timestamp":      now.isoformat(),
                "arrivals":       arrivals,
                "trip_updates":   trips,
                "crowding":       crowding,
                "notifications":  notifications,
            }

            await websocket.send_text(json.dumps(payload))
            logger.info(
                "WS pushed update for stop %s | crowding: %s | notifications: %d",
                stop_id,
                crowding.get("level", "unknown"),
                len(notifications)
            )

            await asyncio.sleep(PUSH_INTERVAL)

    except WebSocketDisconnect:
        logger.info("WS disconnected: stop %s", stop_id)
    except Exception as e:
        logger.error("WS error for stop %s: %s", stop_id, e)
        try:
            await websocket.close()
        except Exception:
            pass