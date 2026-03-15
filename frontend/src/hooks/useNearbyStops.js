import { useState, useEffect } from 'react';
import { getNearbyStops } from '../services/api';

export default function useNearbyStops(lat, lon, radiusKm = 0.5) {
  const [stops, setStops]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;

    setLoading(true);
    setError(null);

    getNearbyStops(lat, lon, radiusKm)
      .then((data) => {
        setStops(data.stops || []);
      })
      .catch((err) => {
        setError(err?.detail?.message || 'Failed to load nearby stops');
      })
      .finally(() => setLoading(false));

  }, [lat, lon, radiusKm]);

  return { stops, loading, error };
}