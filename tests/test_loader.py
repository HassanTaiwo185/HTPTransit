"""
test_loader.py — verify loader populates store correctly from real GTFS files.
"""
import pytest
from app.data.loader import load_all
from app.data import store


@pytest.fixture(autouse=True)
def load_data():
    """Load GTFS data once before each test."""
    load_all()


def test_stops_loaded():
    assert len(store.stop_info) > 0, "stop_info should not be empty"


def test_trips_loaded():
    assert len(store.trip_info) > 0, "trip_info should not be empty"


def test_routes_loaded():
    assert len(store.route_info) > 0, "route_info should not be empty"


def test_calendar_loaded():
    assert len(store.calendar_info) > 0, "calendar_info should not be empty"


def test_stop_to_trips_loaded():
    assert len(store.stop_to_trips) > 0, "stop_to_trips should not be empty"


def test_stop_has_correct_fields():
    """Every stop should have name, lat, lon."""
    for stop_id, info in store.stop_info.items():
        assert "stop_name" in info, f"Stop {stop_id} missing stop_name"
        assert "stop_lat"  in info, f"Stop {stop_id} missing stop_lat"
        assert "stop_lon"  in info, f"Stop {stop_id} missing stop_lon"


def test_trip_has_correct_fields():
    """Every trip should have route_id and service_id."""
    for trip_id, info in store.trip_info.items():
        assert "route_id"   in info, f"Trip {trip_id} missing route_id"
        assert "service_id" in info, f"Trip {trip_id} missing service_id"


def test_stop_to_trips_matches_trip_info():
    """Every trip referenced in stop_to_trips should exist in trip_info."""
    for stop_id, trips in store.stop_to_trips.items():
        for trip_id in trips:
            assert trip_id in store.trip_info, \
                f"Trip {trip_id} in stop_to_trips but missing from trip_info"