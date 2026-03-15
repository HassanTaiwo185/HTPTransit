"""
live.py — WS /ws/live/{stop_id}
One nearby_routes API call per push cycle, shared between arrivals + trip updates.
"""
import json
import asyncio
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config  import TRANSIT_API_KEY, TRANSIT_BASE_URL
from app.core.limiter import transit_limiter, RateLimitExceeded
from app.ml.predictor import predict
from app.data         import store

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

PUSH_INTERVAL = 30


def _get_stop_sequence(trip_id: str, stop_id: str) -> int:
    return store.stop_trip_sequence.get((stop_id, trip_id), -1)


def _parse_nearby_routes(data: dict, stop_id: str, now: datetime) -> tuple:
    """
    Parse a single nearby_routes API response into both arrivals and trip_updates.
    Returns (arrivals_dict, trip_updates_dict).
    """
    arrivals_list = []
    routes_list   = []

    for route in data.get("routes", []):
        global_route_id  = route.get("global_route_id")
        route_short_name = route.get("route_short_name", "")
        route_long_name  = route.get("route_long_name", "")
        route_color      = f"#{route.get('route_color', '888888') or '888888'}"
        route_text_color = f"#{route.get('route_text_color', 'ffffff') or 'ffffff'}"

        routes_list.append({
            "global_route_id":    global_route_id,
            "route_short_name":   route_short_name,
            "route_long_name":    route_long_name,
            "real_time_arrivals": route.get("itineraries", []),
        })

        for itin in route.get("itineraries", []):
            headsign       = itin.get("headsign", "")
            schedule_items = [
                s for s in itin.get("schedule_items", [])
                if s.get("departure_time") and
                   (datetime.fromtimestamp(s["departure_time"]) - now).total_seconds() >= 0
            ]
            if not schedule_items:
                continue

            first       = schedule_items[0]
            dep_dt      = datetime.fromtimestamp(first["departure_time"])
            arrives_min = round((dep_dt - now).total_seconds() / 60, 1)

            next_deps = []
            for s in schedule_items[1:3]:
                s_dt = datetime.fromtimestamp(s["departure_time"])
                next_deps.append({
                    "start_time":     s["departure_time"],
                    "is_real_time":   s.get("is_real_time", False),
                    "arrives_in_min": round((s_dt - now).total_seconds() / 60, 1),
                })

            arrivals_list.append({
                "trip_id":          first.get("trip_id", ""),
                "route_short_name": route_short_name,
                "route_long_name":  route_long_name,
                "route_color":      route_color,
                "route_text_color": route_text_color,
                "headsign":         headsign,
                "arrival_time":     dep_dt.strftime("%H:%M:%S"),
                "stop_time":        dep_dt.strftime("%-I:%M %p"),
                "arrives_in_min":   arrives_min,
                "is_real_time":     first.get("is_real_time", False),
                "global_route_id":  global_route_id,
                "next_departures":  next_deps,
            })

    arrivals_list.sort(key=lambda x: x["arrives_in_min"])

    stop     = store.stop_info.get(stop_id, {})
    arrivals = {
        "stop_id":   stop_id,
        "stop_name": stop.get("stop_name", ""),
        "stop_lat":  stop.get("stop_lat"),
        "stop_lon":  stop.get("stop_lon"),
        "arrivals":  arrivals_list[:5],
    }
    trips = {
        "stop_id":   stop_id,
        "stop_name": stop.get("stop_name", ""),
        "routes":    routes_list,
    }
    return arrivals, trips


def _check_notifications(arrivals, origin_stop_id, dest_stop_id=None):
    notifications = []
    if not arrivals.get("arrivals"):
        return notifications

    for arrival in arrivals["arrivals"]:
        trip_id    = arrival.get("trip_id", "")
        arrives_in = arrival.get("arrives_in_min", 999)
        route_name = arrival.get("route_short_name", "Bus")
        stop_time  = arrival.get("stop_time", "")

        if arrives_in <= 5:
            notifications.append({
                "type":           "bus_approaching",
                "message":        f"Bus {route_name} arriving at {stop_time} — head to stop now!",
                "trip_id":        trip_id,
                "arrives_in_min": arrives_in,
                "action":         "head_to_stop",
            })

        if dest_stop_id:
            origin_seq = _get_stop_sequence(trip_id, origin_stop_id)
            dest_seq   = _get_stop_sequence(trip_id, dest_stop_id)
            if origin_seq != -1 and dest_seq != -1 and dest_seq > origin_seq:
                stops_away = dest_seq - origin_seq
                if stops_away <= 2:
                    notifications.append({
                        "type":       "prepare_to_exit",
                        "message":    f"Your stop is {stops_away} stop(s) away — prepare to exit!",
                        "trip_id":    trip_id,
                        "stops_away": stops_away,
                        "action":     "prepare_exit",
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
async def live_stop(websocket: WebSocket, stop_id: str, dest_stop_id: str = None):
    await websocket.accept()
    logger.info("WS connected: stop %s → dest %s", stop_id, dest_stop_id)

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
            stop       = store.stop_info.get(stop_id, {})

            # ── ONE API call for both arrivals + trip updates ──────────────
            arrivals = {"stop_id": stop_id, "arrivals": []}
            trips    = {"stop_id": stop_id, "routes":   []}
            try:
                await transit_limiter.acquire()
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{TRANSIT_BASE_URL}/nearby_routes",
                        headers={"apiKey": TRANSIT_API_KEY},
                        params={
                            "lat":          stop.get("stop_lat"),
                            "lon":          stop.get("stop_lon"),
                            "max_distance": 200,
                        },
                        timeout=10.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                arrivals, trips = _parse_nearby_routes(data, stop_id, now)
            except RateLimitExceeded:
                logger.warning("WS rate limited for stop %s", stop_id)
            except Exception as e:
                logger.warning("WS nearby_routes failed for stop %s: %s", stop_id, e)

            # ── ML crowding ────────────────────────────────────────────────
            if 7 <= hour <= 9 or 16 <= hour <= 19:
                boardings, alightings = 150.0, 80.0
            elif 22 <= hour or hour <= 5:
                boardings, alightings = 10.0, 5.0
            else:
                boardings, alightings = 50.0, 25.0

            crowding = predict(
                boardings  = boardings,
                alightings = alightings,
                stop_lat   = stop.get("stop_lat"),
                stop_lon   = stop.get("stop_lon"),
                hour       = hour,
                is_weekend = is_weekend,
            )

            notifications = _check_notifications(arrivals, stop_id, dest_stop_id)

            await websocket.send_text(json.dumps({
                "type":          "live_update",
                "stop_id":       stop_id,
                "dest_stop_id":  dest_stop_id,
                "timestamp":     now.isoformat(),
                "arrivals":      arrivals,
                "trip_updates":  trips,
                "crowding":      crowding,
                "notifications": notifications,
            }))

            logger.info(
                "WS pushed update for stop %s | crowding: %s | notifications: %d",
                stop_id, crowding.get("level", "unknown"), len(notifications),
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