import { useState } from 'react';
import { getPlan } from '../services/api';

export default function usePlan() {
  const [plans, setPlan]        = useState([]);
  const [routeIds, setRouteIds] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const fetchPlan = async (fromLat, fromLon, toLat, toLon) => {
    if (!fromLat || !fromLon || !toLat || !toLon) return;

    setLoading(true);
    setError(null);
    setPlan([]);

    try {
      // FIX: wrap into the object shape getPlan expects
      const data = await getPlan({
        origin:      { lat: fromLat, lon: fromLon },
        destination: { lat: toLat,   lon: toLon   },
      });
      setPlan(data.plans       || []);
      setRouteIds(data.route_ids || []);
    } catch (err) {
      setError(err?.message || 'Failed to get trip plan');
    } finally {
      setLoading(false);
    }
  };

  const clearPlan = () => {
    setPlan([]);
    setRouteIds([]);
    setError(null);
  };

  return { plans, routeIds, loading, error, fetchPlan, clearPlan };
}