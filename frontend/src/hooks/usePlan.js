import { useState } from 'react';
import { getPlan } from '../services/api';

export default function usePlan() {
  const [plans, setPlan]      = useState([]);
  const [routeIds, setRouteIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchPlan = async (fromLat, fromLon, toLat, toLon) => {
    if (!fromLat || !fromLon || !toLat || !toLon) return;

    setLoading(true);
    setError(null);
    setPlan([]);

    try {
      const data = await getPlan(fromLat, fromLon, toLat, toLon);
      setPlan(data.plans     || []);
      setRouteIds(data.route_ids || []);
    } catch (err) {
      setError(err?.detail?.message || 'Failed to get trip plan');
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