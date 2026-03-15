import { useState, useEffect } from 'react';
import { getTripStops } from '../services/api';

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStopIndex(stops, vehicles) {
  if (!vehicles?.length || !stops?.length) return -1;
  let bestIndex = -1;
  let bestDist  = Infinity;
  vehicles.forEach((v) => {
    if (!v.latitude || !v.longitude) return;
    stops.forEach((stop, i) => {
      if (!stop.stop_lat || !stop.stop_lon) return;
      const d = distanceMeters(v.latitude, v.longitude, stop.stop_lat, stop.stop_lon);
      if (d < bestDist) { bestDist = d; bestIndex = i; }
    });
  });
  return bestDist < 200 ? bestIndex : -1;
}

export default function RouteStopSheet({ leg, onClose, vehicles = [] }) {
  const [stops,             setStops]             = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [selectedDeparture, setSelectedDeparture] = useState(0);

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCrowdingLabel = (ts) => {
    if (!ts) return null;
    const hour = new Date(ts * 1000).getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19))
      return { label: 'Busy',        color: 'text-orange-500 bg-orange-50' };
    if (hour >= 10 && hour <= 15)
      return { label: 'Moderate',    color: 'text-yellow-600 bg-yellow-50' };
    return   { label: 'Not Crowded', color: 'text-green-600 bg-green-50' };
  };

  // Build departure slots:
  // - slot 0: real departure from leg
  // - slots 1 & 2: use next_departures from leg if available, otherwise estimate +30/+60
  const nextDeps = leg?.next_departures || [];
  const departures = leg ? [
    {
      mins:         Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)),
      is_real_time: leg.is_real_time,
      status:       leg.is_real_time ? 'Live' : 'Scheduled',
      start_time:   leg.start_time,
    },
    {
      mins:         nextDeps[0]
                      ? Math.max(0, Math.round((nextDeps[0].start_time * 1000 - Date.now()) / 60000))
                      : Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)) + 30,
      is_real_time: nextDeps[0]?.is_real_time ?? false,
      status:       nextDeps[0]?.is_real_time ? 'Live' : 'Scheduled',
      start_time:   nextDeps[0]?.start_time ?? (leg.start_time + 1800),
    },
    {
      mins:         nextDeps[1]
                      ? Math.max(0, Math.round((nextDeps[1].start_time * 1000 - Date.now()) / 60000))
                      : Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)) + 60,
      is_real_time: nextDeps[1]?.is_real_time ?? false,
      status:       nextDeps[1]?.is_real_time ? 'Live' : 'Scheduled',
      start_time:   nextDeps[1]?.start_time ?? (leg.start_time + 3600),
    },
  ] : [];

  // Always load stops from the real trip_id — same stops regardless of which
  // departure is selected (same route, same stop sequence)
  useEffect(() => {
    if (!leg?.trip_id) {
      if (leg?.stop_times?.length) setStops(leg.stop_times);
      return;
    }
    setLoading(true);
    setError(null);
    getTripStops(leg.trip_id, leg.start_time, leg.route)
      .then(data => {
        const fetched = data.stops || [];
        if (fetched.length > 0) {
          setStops(fetched);
        } else if (leg?.stop_times?.length) {
          setStops(leg.stop_times);
        }
      })
      .catch(() => {
        if (leg?.stop_times?.length) {
          setStops(leg.stop_times);
        } else {
          setError('Could not load stops');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg?.trip_id]);

  if (!leg) return null;

  const activeDeparture = departures[selectedDeparture] ?? departures[0];
  const crowding        = getCrowdingLabel(activeDeparture?.start_time);
  const busStopIndex    = findNearestStopIndex(stops, vehicles);
  const hasBusPosition  = busStopIndex !== -1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-white rounded-t-2xl shadow-2xl flex flex-col h-[68vh]">

      {/* Handle */}
      <div className="flex justify-center pt-2.5 pb-1 shrink-0">
        <div className="w-8 h-1 rounded-full bg-gray-300" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0 transition-colors"
        >
          ←
        </button>
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white text-sm font-bold tracking-tight">{leg.route}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-gray-900 tracking-tight">
            DRT {leg.route} Bus
          </p>
          {leg.headsign && (
            <p className="text-[11px] text-gray-400 truncate">Towards {leg.headsign}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {hasBusPosition && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
          )}
          {crowding && (
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${crowding.color}`}>
              {crowding.label}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1 pb-6">

        {/* Departures — 3 cards */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Upcoming Departures
            </span>
            <span className="text-[11px] text-gray-400">
              {leg?.next_departures?.length ? 'Real-time' : 'Every ~30 min'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {departures.map((dep, i) => (
              <button
                key={i}
                onClick={() => setSelectedDeparture(i)}
                className={`rounded-2xl px-2 py-3.5 text-center transition-all border ${
                  i === selectedDeparture
                    ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200'
                    : 'bg-white border-gray-200 hover:border-blue-300 active:bg-blue-50'
                }`}
              >
                <p className={`text-[17px] font-bold leading-none ${i === selectedDeparture ? 'text-white' : 'text-gray-900'}`}>
                  {dep.mins}
                </p>
                <p className={`text-[10px] mt-0.5 ${i === selectedDeparture ? 'text-blue-200' : 'text-gray-400'}`}>
                  min
                </p>
                <p className={`text-[11px] mt-1.5 font-medium ${i === selectedDeparture ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatTime(dep.start_time)}
                </p>
                <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wide ${
                  dep.is_real_time
                    ? i === selectedDeparture ? 'text-green-300' : 'text-green-500'
                    : i === selectedDeparture ? 'text-blue-300'  : 'text-gray-400'
                }`}>
                  {dep.status}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Departs info bar */}
        <div className="mx-3 mb-3 px-4 py-2.5 bg-blue-50 rounded-xl flex items-center justify-between border border-blue-100">
          <span className="text-[12px] font-semibold text-blue-700">
            Departs {formatTime(activeDeparture?.start_time)}
          </span>
          {crowding && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${crowding.color}`}>
              {crowding.label}
            </span>
          )}
        </div>

        {/* Stops */}
        <div className="px-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Stops
            </span>
            {stops.length > 0 && (
              <span className="text-[11px] font-semibold text-blue-500">
                {stops.length} stops
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-5">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading stops...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 border border-red-100">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && stops.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No stops found</p>
          )}

          {!loading && stops.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {stops.map((stop, i) => {
                const isFirst   = i === 0;
                const isLast    = i === stops.length - 1;
                const isBusHere = hasBusPosition && i === busStopIndex;
                const isPassed  = hasBusPosition && i < busStopIndex;

                return (
                  <div key={stop.stop_id || stop.global_stop_id || i}>
                    {isBusHere && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border-y border-green-100">
                        <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <rect x="1" y="5" width="22" height="13" rx="3" fill="white" opacity="0.9"/>
                            <rect x="3" y="7" width="7" height="5" rx="1" fill="#22c55e" opacity="0.8"/>
                            <rect x="14" y="7" width="7" height="5" rx="1" fill="#22c55e" opacity="0.8"/>
                            <circle cx="5.5" cy="18.5" r="2" fill="white" stroke="#22c55e" strokeWidth="1.5"/>
                            <circle cx="18.5" cy="18.5" r="2" fill="white" stroke="#22c55e" strokeWidth="1.5"/>
                          </svg>
                        </div>
                        <span className="text-[11px] font-semibold text-green-700">Bus is here</span>
                        <span className="ml-auto text-[10px] text-green-500 font-medium">Live position</span>
                      </div>
                    )}

                    <div className="flex items-stretch">
                      <div className="flex flex-col items-center w-10 shrink-0">
                        <div className={`w-0.5 flex-none h-4 ${isFirst ? 'bg-transparent' : isPassed ? 'bg-gray-200' : 'bg-blue-200'}`} />
                        <div className={`rounded-full shrink-0 border-2 z-10 transition-all ${
                          isFirst || isLast
                            ? 'w-3.5 h-3.5 bg-blue-600 border-blue-600'
                            : isPassed
                              ? 'w-2.5 h-2.5 bg-gray-300 border-gray-300'
                              : 'w-2.5 h-2.5 bg-white border-blue-300'
                        }`} />
                        {!isLast && (
                          <div className={`w-0.5 flex-1 min-h-[16px] ${isPassed ? 'bg-gray-200' : 'bg-blue-200'}`} />
                        )}
                        {isLast && <div className="h-4" />}
                      </div>

                      <div className={`flex-1 flex items-center justify-between py-2.5 pr-4 ${!isLast ? 'border-b border-gray-50' : ''}`}>
                        <p className={`text-[13px] leading-snug ${
                          isFirst  ? 'font-semibold text-gray-900' :
                          isLast   ? 'font-semibold text-blue-600' :
                          isPassed ? 'text-gray-300' :
                                     'text-gray-600'
                        }`}>
                          {stop.stop_name}
                        </p>
                        {stop.stop_time && (
                          <p className={`text-[11px] font-semibold ml-2 shrink-0 ${
                            isFirst  ? 'text-blue-600' :
                            isPassed ? 'text-gray-300' :
                                       'text-gray-400'
                          }`}>
                            {stop.stop_time}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}