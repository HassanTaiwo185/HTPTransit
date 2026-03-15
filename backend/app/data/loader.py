"""
loader.py — reads Durham Transit GTFS files into memory at startup.
"""
import csv
import logging
from pathlib import Path

from app.data import store
from app.services.crowding_service import load_population_data


logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def _open(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing: {path}")
    return open(path, encoding="utf-8-sig")


def _load_stop_times():
    logger.info("Loading stop_times.txt ...")
    with _open("stop_times.txt") as f:
        for row in csv.DictReader(f):
            stop_id = row["stop_id"]
            trip_id = row["trip_id"]
            arrival = row["arrival_time"]
            seq     = int(row["stop_sequence"])

            store.stop_to_trips.setdefault(stop_id, []).append(trip_id)
            store.trip_to_stops.setdefault(trip_id, []).append(stop_id)
            store.stop_to_arrivals.setdefault(stop_id, []).append(arrival)
            store.stop_trip_sequence[(stop_id, trip_id)] = seq

    logger.info("  → %d stops indexed", len(store.stop_to_trips))


def _load_trips():
    logger.info("Loading trips.txt ...")
    with _open("trips.txt") as f:
        for row in csv.DictReader(f):
            store.trip_info[row["trip_id"]] = {
                "route_id":      row.get("route_id", ""),
                "service_id":    row.get("service_id", ""),
                "trip_headsign": row.get("trip_headsign", ""),
                "direction_id":  row.get("direction_id", ""),
            }
    logger.info("  → %d trips indexed", len(store.trip_info))


def _load_stops():
    logger.info("Loading stops.txt ...")
    with _open("stops.txt") as f:
        for row in csv.DictReader(f):
            store.stop_info[row["stop_id"]] = {
                "stop_name": row.get("stop_name", ""),
                "stop_lat":  float(row["stop_lat"]) if row.get("stop_lat") else None,
                "stop_lon":  float(row["stop_lon"]) if row.get("stop_lon") else None,
            }
    logger.info("  → %d stops indexed", len(store.stop_info))


def _load_routes():
    logger.info("Loading routes.txt ...")
    with _open("routes.txt") as f:
        for row in csv.DictReader(f):
            store.route_info[row["route_id"]] = {
                "route_short_name": row.get("route_short_name", ""),
                "route_long_name":  row.get("route_long_name", ""),
                "route_type":       row.get("route_type", ""),
            }
    logger.info("  → %d routes indexed", len(store.route_info))


def _load_calendar():
    logger.info("Loading calendar.txt ...")
    with _open("calendar.txt") as f:
        for row in csv.DictReader(f):
            store.calendar_info[row["service_id"]] = {
                "monday":     row.get("monday", "0"),
                "tuesday":    row.get("tuesday", "0"),
                "wednesday":  row.get("wednesday", "0"),
                "thursday":   row.get("thursday", "0"),
                "friday":     row.get("friday", "0"),
                "saturday":   row.get("saturday", "0"),
                "sunday":     row.get("sunday", "0"),
                "start_date": row.get("start_date", ""),
                "end_date":   row.get("end_date", ""),
            }
    logger.info("  → %d service windows indexed", len(store.calendar_info))


def load_all():
    """Call once from FastAPI startup."""
    logger.info("=== Loading Durham Transit GTFS ===")
    _load_stop_times()
    _load_trips()
    _load_stops()
    _load_routes()
    _load_calendar()
    load_population_data()
    logger.info("=== Done ===")


def _enrich_stop_route_counts():
    """Add route_count to each stop in stop_info."""
    logger.info("Enriching stops with route counts...")

    stop_routes: dict[str, set] = {}
    for trip_id, trip in store.trip_info.items():
        route_id = trip.get("route_id")
        for stop_id in store.trip_to_stops.get(trip_id, []):
            stop_routes.setdefault(stop_id, set()).add(route_id)

    for stop_id, info in store.stop_info.items():
        info["route_count"] = len(stop_routes.get(stop_id, set())) or 1

    logger.info("  → route_count added to %d stops", len(store.stop_info))
