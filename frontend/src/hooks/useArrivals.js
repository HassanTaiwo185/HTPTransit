import { useState, useEffect } from 'react';
import { getArrivals } from '../services/api';

export default function useArrivals(stopId, limit = 5) {
  const [arrivals, setArrivals] = useState([]);
  const [stopName, setStopName] = useState('');
  const [stopLat, setStopLat]   = useState(null);
  const [stopLon, setStopLon]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!stopId) return;

    setLoading(true);
    setError(null);

    getArrivals(stopId, limit)
      .then((data) => {
        setArrivals(data.arrivals || []);
        setStopName(data.stop_name || '');
        setStopLat(data.stop_lat  || null);
        setStopLon(data.stop_lon  || null);
      })
      .catch((err) => {
        setError(err?.detail?.message || 'Failed to load arrivals');
      })
      .finally(() => setLoading(false));

  }, [stopId, limit]);

  return { arrivals, stopName, stopLat, stopLon, loading, error };
}