"""
Global in-memory store.
Populated once at startup by loader.py, read-only after that.
"""
from typing import Dict, List

# stop_id -> [trip_id, ...]
stop_to_trips: Dict[str, List[str]] = {}

# trip_id -> [stop_id, ...]
trip_to_stops: Dict[str, List[str]] = {}

# stop_id -> [arrival_time, ...]
stop_to_arrivals: Dict[str, List[str]] = {}

# (stop_id, trip_id) -> stop_sequence int
stop_trip_sequence: Dict[tuple, int] = {}

# trip_id -> { route_id, service_id, trip_headsign, direction_id }
trip_info: Dict[str, dict] = {}

# stop_id -> { stop_name, stop_lat, stop_lon }
stop_info: Dict[str, dict] = {}

# route_id -> { route_short_name, route_long_name, route_type }
route_info: Dict[str, dict] = {}

# service_id -> { monday..sunday, start_date, end_date }
calendar_info: Dict[str, dict] = {}