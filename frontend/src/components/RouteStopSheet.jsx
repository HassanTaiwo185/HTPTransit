import { useState, useEffect } from 'react';
import { getTripStops } from '../services/api';
import CrowdingBadge from './CrowdingBadge';

export default function RouteStopSheet({ leg, onClose }) {
  const [stops, setStops]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const getCrowding = (timestamp) => {
    if (!timestamp) return 'normal';
    const hour = new Date(timestamp * 1000).getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 'overcrowded';
    if (hour >= 10 && hour <= 15) return 'normal';
    return 'not_crowded';
  };

  const departures = leg ? [
    {
      mins:         Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)),
      is_real_time: leg.is_real_time,
      status:       leg.is_real_time ? 'On-time' : 'Scheduled',
    },
    {
      mins:         Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)) + 30,
      is_real_time: leg.is_real_time,
      status:       leg.is_real_time ? 'On-time' : 'Scheduled',
    },
    {
      mins:         Math.max(0, Math.round((leg.start_time * 1000 - Date.now()) / 60000)) + 60,
      is_real_time: false,
      status:       'Scheduled',
    },
  ] : [];

  useEffect(() => {
    if (!leg?.trip_id) return;
    setLoading(true);
    setError(null);
    getTripStops(leg.trip_id, leg.start_time)
      .then(data => setStops(data.stops || []))
      .catch(() => setError('Could not load stops'))
      .finally(() => setLoading(false));
  }, [leg?.trip_id]);

  if (!leg) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1100] bg-white rounded-t-3xl shadow-2xl pt-3 pb-8 max-h-[80vh] overflow-y-auto">

      {/* Handle */}
      <div className="flex justify-center mb-3">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg px-2.5 py-1">
            <span className="text-white text-sm font-bold">{leg.route}</span>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">DRT {leg.route} Bus</p>
            {leg.headsign && (
              <p className="text-xs text-gray-500">{leg.headsign}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
        >×</button>
      </div>

      {/* Upcoming departures — horizontal scroll */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-900">Upcoming Departures</p>
          <p className="text-xs text-gray-400">Every ~30 mins</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {departures.map((dep, i) => (
            <div
              key={i}
              className={`shrink-0 rounded-2xl px-4 py-3 min-w-[100px] text-center
                ${i === 0 ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <p className={`text-base font-bold ${i === 0 ? 'text-white' : 'text-gray-800'}`}>
                {dep.mins} mins
              </p>
              {dep.is_real_time && (
                <p className="text-xs text-blue-400">📶</p>
              )}
              <p className={`text-xs mt-0.5 ${
                dep.status === 'On-time'
                  ? i === 0 ? 'text-green-400' : 'text-green-600'
                  : 'text-gray-400'
              }`}>
                {dep.status}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Crowding prediction */}
      <div className="px-4 mb-4">
        <CrowdingBadge level={getCrowding(leg.start_time)} />
      </div>

      {/* Stops timeline */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-900">Stops</p>
          <p className="text-xs text-blue-500 font-medium">
            {stops.length} stops total
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading stops...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 py-2">{error}</p>
        )}

        {!loading && !error && stops.length === 0 && (
          <p className="text-sm text-gray-400 py-4">No stops found for this trip</p>
        )}

        {!loading && stops.length > 0 && (
          <div className="relative">
            {stops.map((stop, i) => {
              const isLast    = i === stops.length - 1;
              const isCurrent = i === 0;

              // use real-time stop time from Transit API if available
              const realTime = leg.stop_times?.find(
                st => st.global_stop_id === `DRTON:${stop.stop_id}`
              );
              const displayTime = realTime?.stop_time || stop.stop_time;

              return (
                <div key={stop.stop_id} className="flex items-start gap-3 min-h-[44px]">

                  {/* Timeline */}
                  <div className="flex flex-col items-center w-5 shrink-0">
                    <div className={`w-0.5 h-3 ${i === 0 ? 'bg-transparent' : 'bg-blue-400'}`} />
                    <div className={`rounded-full border-2 shrink-0 ${
                      isCurrent
                        ? 'w-4 h-4 bg-blue-500 border-blue-500'
                        : isLast
                          ? 'w-4 h-4 bg-blue-500 border-blue-500'
                          : 'w-3 h-3 bg-white border-blue-400'
                    }`} />
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-blue-400 min-h-[20px]" />
                    )}
                  </div>

                  {/* Stop info */}
                  <div className={`flex-1 flex items-center justify-between pb-3 ${
                    !isLast ? 'border-b border-gray-50' : ''
                  }`}>
                    <p className={`text-sm ${
                      isCurrent ? 'font-bold text-gray-900' : 'text-gray-600'
                    }`}>
                      {stop.stop_name}
                    </p>
                    {displayTime && (
                      <p className={`text-xs font-semibold ml-2 shrink-0 ${
                        isCurrent ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {displayTime}
                        {realTime?.is_real_time && (
                          <span className="text-blue-400 ml-1">●</span>
                        )}
                      </p>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}