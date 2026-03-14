"""
test_arrivals_service.py — verify next arrivals logic.
"""
import pytest
from app.data.loader import load_all
from app.data import store
from app.services.arrivals_service import get_next_arrivals


@pytest.fixture(autouse=True)
def load_data():
    load_all()


def test_invalid_stop_returns_error():
    result = get_next_arrivals("INVALID_STOP_999")
    assert "error" in result


def test_valid_stop_returns_dict():
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id)
    assert isinstance(result, dict)
    assert "arrivals" in result


def test_arrivals_is_list():
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id)
    assert isinstance(result["arrivals"], list)


def test_arrivals_respect_limit():
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id, limit=3)
    assert len(result["arrivals"]) <= 3


def test_arrival_has_correct_fields():
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id, limit=5)
    for arrival in result["arrivals"]:
        assert "trip_id"          in arrival
        assert "route_id"         in arrival
        assert "arrival_time"     in arrival
        assert "arrives_in_min"   in arrival
        assert "stop_time"        in arrival   # ← new
        assert "route_color"      in arrival   # ← new
        assert "route_text_color" in arrival   # ← new


def test_arrivals_sorted_soonest_first():
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id, limit=5)
    times = [a["arrives_in_min"] for a in result["arrivals"]]
    assert times == sorted(times)


def test_stop_time_format():
    """stop_time should be in 12hr format like '2:32 PM'."""
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id, limit=5)
    for arrival in result["arrivals"]:
        assert "AM" in arrival["stop_time"] or "PM" in arrival["stop_time"]


def test_route_color_has_hash():
    """route_color should start with #."""
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id, limit=5)
    for arrival in result["arrivals"]:
        assert arrival["route_color"].startswith("#")
        assert arrival["route_text_color"].startswith("#")


def test_stop_has_location():
    """Stop result should include lat/lon for map pin."""
    stop_id = next(iter(store.stop_info))
    result = get_next_arrivals(stop_id)
    assert "stop_lat" in result
    assert "stop_lon" in result