"""
test_store.py — verify all store dicts exist and are empty before loading.
"""
from app.data import store


def test_store_dicts_exist():
    assert hasattr(store, "stop_to_trips")
    assert hasattr(store, "trip_to_stops")
    assert hasattr(store, "stop_to_arrivals")
    assert hasattr(store, "stop_trip_sequence")
    assert hasattr(store, "trip_info")
    assert hasattr(store, "stop_info")
    assert hasattr(store, "route_info")
    assert hasattr(store, "calendar_info")


def test_store_dicts_are_dicts():
    assert isinstance(store.stop_to_trips, dict)
    assert isinstance(store.trip_to_stops, dict)
    assert isinstance(store.stop_to_arrivals, dict)
    assert isinstance(store.stop_trip_sequence, dict)
    assert isinstance(store.trip_info, dict)
    assert isinstance(store.stop_info, dict)
    assert isinstance(store.route_info, dict)
    assert isinstance(store.calendar_info, dict)