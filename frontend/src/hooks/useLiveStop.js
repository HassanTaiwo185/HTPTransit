import { useState, useEffect, useRef, useCallback } from 'react';
import { getArrivals } from '../services/api';

const POLL_INTERVAL = 60_000; // 1 minute

export default function useLiveStop(stopId, destStopId = null) {
  const [arrivals,      setArrivals]      = useState([]);
  const [stopName,      setStopName]      = useState('');
  const [stopLat,       setStopLat]       = useState(null);
  const [stopLon,       setStopLon]       = useState(null);
  const [crowding,      setCrowding]      = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  const timerRef     = useRef(null);
  const isFetching   = useRef(false);

  const fetchOnce = useCallback(async (id) => {
    if (isFetching.current) return;   // skip if previous call still in-flight
    isFetching.current = true;
    setError(null);

    try {
      const data = await getArrivals(id);

      setArrivals(data.arrivals  || []);
      setStopName(data.stop_name || '');
      setStopLat(data.stop_lat   ?? null);
      setStopLon(data.stop_lon   ?? null);

      // crowding + notifications come from the same REST response
      // if your backend attaches them; otherwise these stay null/[]
      if (data.crowding)      setCrowding(data.crowding);
      if (data.notifications) setNotifications(data.notifications);
    } catch (err) {
      setError(err?.message || 'Failed to load arrivals');
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!stopId) {
      // clean up if stopId becomes null
      setArrivals([]);
      setCrowding(null);
      setNotifications([]);
      return;
    }

    // immediate first fetch
    setLoading(true);
    fetchOnce(stopId);

    // then poll every minute
    timerRef.current = setInterval(() => fetchOnce(stopId), POLL_INTERVAL);

    return () => {
      clearInterval(timerRef.current);
      isFetching.current = false;
    };
  }, [stopId, destStopId, fetchOnce]);

  return {
    // arrivals-style fields (drop-in for useArrivals)
    arrivals,
    stopName,
    stopLat,
    stopLon,
    loading,
    error,
    // live-style fields (drop-in for useLiveStop)
    crowding,
    notifications,
    connected: !loading && !error && arrivals.length > 0,
  };
}