"""
test_stops_service.py — verify haversine and nearby stop logic.
"""
import pytest
from app.data.loader import load_all
from app.data import store
from app.services.stops_service import get_nearby_stops, _haversine


@pytest.fixture(autouse=True)
def load_data():
    load_all()


def test_haversine_same_point():
    """Distance from a point to itself should be 0."""
    assert _haversine(43.8971, -78.8658, 43.8971, -78.8658) == 0.0


def test_haversine_known_distance():
    """
    Durham Region Transit HQ to Oshawa Station is roughly 2km.
    Result should be in that ballpark.
    """
    dist = _haversine(43.8971, -78.8658, 43.8736, -78.8441)
    assert 1.0 < dist < 5.0, f"Expected ~2km, got {dist}"


def test_nearby_stops_returns_list():
    """Should always return a list."""
    result = get_nearby_stops(43.8971, -78.8658)
    assert isinstance(result, list)


def test_nearby_stops_sorted_by_distance():
    """Results should be sorted closest first."""
    results = get_nearby_stops(43.8971, -78.8658, radius_km=2.0)
    if len(results) > 1:
        for i in range(len(results) - 1):
            assert results[i]["distance_km"] <= results[i + 1]["distance_km"]


def test_nearby_stops_within_radius():
    """All returned stops should be within the requested radius."""
    radius = 0.5
    results = get_nearby_stops(43.8971, -78.8658, radius_km=radius)
    for stop in results:
        assert stop["distance_km"] <= radius


def test_nearby_stops_have_correct_fields():
    """Each stop result should have all required fields."""
    results = get_nearby_stops(43.8971, -78.8658, radius_km=2.0)
    for stop in results:
        assert "stop_id"     in stop
        assert "stop_name"   in stop
        assert "stop_lat"    in stop
        assert "stop_lon"    in stop
        assert "distance_km" in stop


def test_no_stops_far_away():
    """Middle of the ocean should return no stops."""
    results = get_nearby_stops(0.0, 0.0, radius_km=0.5)
    assert results == []