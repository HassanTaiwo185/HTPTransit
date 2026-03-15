const API_BASE = "http://localhost:8000/api";

/* ----------------------------- PLAN TRIP ----------------------------- */
/* ----------------------------- PLAN TRIP ----------------------------- */
export async function getPlan(data) {
  // Ensure the keys match the Pydantic model exactly
  const payload = {
    from_lat: data.origin.lat,
    from_lon: data.origin.lon,
    to_lat: data.destination.lat,
    to_lon: data.destination.lon,
    mode: "transit",
    num_results: 3
  };

  const res = await fetch(`${API_BASE}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to fetch trip plan");
  return res.json();
}


/* --------------------------- NEARBY STOPS --------------------------- */
export async function getNearbyStops(lat, lon) {
  const res = await fetch(
    `${API_BASE}/stops/nearby?lat=${lat}&lon=${lon}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch nearby stops");
  }

  return res.json();
}


/* --------------------------- STOP ARRIVALS --------------------------- */
export async function getArrivals(stopId) {
  const res = await fetch(`${API_BASE}/stop/${stopId}/arrivals`);

  if (!res.ok) {
    throw new Error("Failed to fetch arrivals");
  }

  return res.json();
}


/* ------------------------- CROWDING PREDICTION ------------------------ */
export async function predictCrowding(routeId, hour) {
  const res = await fetch(
    `${API_BASE}/predict/crowding?route_id=${routeId}&hour=${hour}`
  );

  if (!res.ok) {
    throw new Error("Failed to predict crowding");
  }

  return res.json();
}


/* ------------------------- LIVE STOP WEBSOCKET ------------------------ */
export function connectLiveStop(stopId, onMessage) {
  const ws = new WebSocket(`ws://localhost:8000/ws/stop/${stopId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  return ws;
}


export async function getTripStops(tripId) {
  if (!tripId) {
    throw new Error("tripId required");
  }

  const res = await fetch(`${API_BASE}/trip/${tripId}/stops`);

  if (!res.ok) {
    throw new Error("Failed to fetch trip stops");
  }

  return res.json();
}