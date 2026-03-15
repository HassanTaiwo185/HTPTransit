import { useState, useEffect, useRef } from 'react';
import { connectLiveStop } from '../services/api';

export default function useLiveStop(stopId, destStopId = null) {
  const [arrivals, setArrivals]         = useState([]);
  const [crowding, setCrowding]         = useState(null);
  const [tripUpdates, setTripUpdates]   = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected]       = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!stopId) return;

    // close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = connectLiveStop(stopId, destStopId, (data) => {
      if (data.type === 'connected') {
        setConnected(true);
      }

      if (data.type === 'live_update') {
        setArrivals(data.arrivals?.arrivals   || []);
        setCrowding(data.crowding             || null);
        setTripUpdates(data.trip_updates?.routes || []);
        setNotifications(data.notifications   || []);
      }
    });

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    wsRef.current = ws;

    return () => {
      ws.close();
      setConnected(false);
    };
  }, [stopId, destStopId]);

  return {
    arrivals,
    crowding,
    tripUpdates,
    notifications,
    connected,
  };
}