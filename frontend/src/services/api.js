const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : "http://localhost:8000/api";

const WS_BASE = process.env.REACT_APP_BACKEND_URL
  ? process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws")
  : "ws://localhost:8000";

export async function getPlan(data) {
  const payload = {
    from_lat: data.origin.lat,
    from_lon: data.origin.lon,
    to_lat: data.destination.lat,
    to_lon: data.destination.lon,
    mode: "transit",
    num_results: 3,
    departure_time: data.departureTime ?? null,
  };

  const res = await fetch(`${API_BASE}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to fetch trip plan");

  return res.json();
}

export async function getNearbyStops(lat, lon) {
  const res = await fetch(
    `${API_BASE}/stops/nearby?lat=${lat}&lon=${lon}`
  );

  if (!res.ok) throw new Error("Failed to fetch nearby stops");

  return res.json();
}

export async function getArrivals(stopId) {
  const res = await fetch(
    `${API_BASE}/stop/${encodeURIComponent(stopId)}/arrivals`
  );

  if (!res.ok) throw new Error("Failed to fetch arrivals");

  return res.json();
}

export async function predictCrowding(routeId, hour) {
  const res = await fetch(
    `${API_BASE}/predict/crowding?route_id=${encodeURIComponent(routeId)}&hour=${hour}`
  );

  if (!res.ok) throw new Error("Failed to predict crowding");

  return res.json();
}

export async function getLiveCrowding(rtTripId) {
  if (!rtTripId) {
    return { level: "unknown", source: "unavailable" };
  }

  const res = await fetch(
    `${API_BASE}/vehicle/${encodeURIComponent(rtTripId)}/crowding`
  );

  if (!res.ok) {
    return { level: "unknown", source: "unavailable" };
  }

  return res.json();
}

export function connectLiveStop(stopId, destStopId = null, onMessage) {
  const query = destStopId
    ? `?dest_stop_id=${encodeURIComponent(destStopId)}`
    : "";

  const ws = new WebSocket(
    `${WS_BASE}/ws/live/${encodeURIComponent(stopId)}${query}`
  );

  ws.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };

  return ws;
}

export async function getTripStops(tripId, departureTs = null, route = null) {
  if (!tripId) throw new Error("tripId required");

  const params = new URLSearchParams();

  if (departureTs) {
    params.set("departure_ts", Math.floor(departureTs));
  }

  if (route) {
    params.set("route", route);
  }

  const query = params.toString() ? `?${params}` : "";

  const res = await fetch(
    `${API_BASE}/trips/${encodeURIComponent(tripId)}/stops${query}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch trip stops");
  }

  return res.json();
}

export async function getVehiclePositions(globalRouteId, directionId = null) {
  if (!globalRouteId) {
    return { vehicles: [], available: false };
  }

  const params = new URLSearchParams();

  if (directionId !== null) {
    params.set("direction_id", directionId);
  }

  const query = params.toString() ? `?${params}` : "";

  const res = await fetch(
    `${API_BASE}/route/${encodeURIComponent(globalRouteId)}/vehicles${query}`
  );

  if (!res.ok) {
    return { vehicles: [], available: false };
  }

  return res.json();
}