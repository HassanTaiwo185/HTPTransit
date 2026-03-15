const API_BASE = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : "http://localhost:8000/api";

/* --------------------------- PLAN TRIP --------------------------- */
export async function getPlan(fromLat, fromLon, toLat, toLon) {
  const res = await fetch(`${API_BASE}/plan`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      from_lat:    fromLat,
      from_lon:    fromLon,
      to_lat:      toLat,
      to_lon:      toLon,
      mode:        'transit',
      num_results: 3,
    }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

/* --------------------------- NEARBY STOPS --------------------------- */
export async function getNearbyStops(lat, lon) {
  const res = await fetch(`${API_BASE}/stops/nearby?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch nearby stops");
  return res.json();
}

/* --------------------------- STOP ARRIVALS --------------------------- */
export async function getArrivals(stopId) {
  const res = await fetch(`${API_BASE}/stop/${stopId}/arrivals`);
  if (!res.ok) throw new Error("Failed to fetch arrivals");
  return res.json();
}

/* --------------------------- PREDICT CROWDING --------------------------- */
export async function predictCrowding(data) {
  const res = await fetch(`${API_BASE}/predict`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

/* --------------------------- TRIP STOPS --------------------------- */
export async function getTripStops(tripId, startTime) {
  if (!tripId) throw new Error("tripId required");
  const url = startTime
    ? `${API_BASE}/trips/${tripId}/stops?start_time=${startTime}`
    : `${API_BASE}/trips/${tripId}/stops`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch trip stops");
  return res.json();
}

/* --------------------------- WEBSOCKET --------------------------- */
export function connectLiveStop(stopId, destStopId, onMessage) {
  const ws = new WebSocket(
    destStopId
      ? `ws://localhost:8000/ws/live/${stopId}?dest_stop_id=${destStopId}`
      : `ws://localhost:8000/ws/live/${stopId}`
  );
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onerror   = (e) => console.error('WS error:', e);
  return ws;
}