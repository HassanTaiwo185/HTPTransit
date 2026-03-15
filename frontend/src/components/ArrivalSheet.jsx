export default function ArrivalSheet({ stop, arrivals, loading, onClose, onArrivalSelect }) {
  if (!stop) return null;

  const crowdColor = (level) => ({
    low:     'text-green-600 bg-green-50 border-green-100',
    medium:  'text-amber-600 bg-amber-50 border-amber-100',
    high:    'text-red-500  bg-red-50   border-red-100',
    unknown: 'text-blue-500 bg-blue-50  border-blue-100',
  }[level] ?? 'text-blue-500 bg-blue-50 border-blue-100');

  const crowdLabel = (level) => ({
    low: 'Not Crowded', medium: 'Moderate', high: 'Busy', unknown: '',
  }[level] ?? '');

  return (
    <div className="fixed bottom-14 left-0 right-0 z-[900] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[60vh]">

      {/* Handle */}
      <div className="flex justify-center pt-2.5 pb-1 shrink-0">
        <div className="w-8 h-1 rounded-full bg-blue-100" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-blue-50 shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
            {stop.stop_name}
          </p>
          <p className="text-[11px] text-blue-300 mt-0.5">
            Stop #{stop.stop_id}{stop.distance_km ? ` · ${stop.distance_km}km away` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0 hover:bg-blue-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-3 py-2.5 pb-4 space-y-1.5">

        {loading && (
          <div className="flex items-center justify-center py-8 gap-2.5">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-300">Loading arrivals…</span>
          </div>
        )}

        {!loading && arrivals.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-blue-200">No upcoming arrivals</p>
          </div>
        )}

        {!loading && arrivals.map((arrival, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onArrivalSelect?.(arrival)}
            className="w-full text-left flex items-center gap-3 bg-white border border-blue-100 rounded-2xl px-3 py-3 shadow-sm hover:border-blue-400 hover:shadow-md active:bg-blue-50 transition-all cursor-pointer"
          >
            {/* Route badge */}
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
              <span className="text-white text-xs font-bold tracking-tight">
                {arrival.route_short_name || arrival.route || '?'}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 truncate">
                {arrival.headsign || arrival.route_long_name || 'Unknown'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-blue-300">{arrival.stop_time}</p>
                {arrival.is_real_time && (
                  <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                    Live
                  </span>
                )}
                {arrival.crowd_level && arrival.crowd_level !== 'unknown' && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${crowdColor(arrival.crowd_level)}`}>
                    {crowdLabel(arrival.crowd_level)}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-blue-400 font-medium mt-0.5">Tap to view stops →</p>
            </div>

            {/* ETA */}
            <div className="shrink-0 text-right">
              <p className={`text-[14px] font-bold ${
                arrival.arrives_in_min < 2 ? 'text-green-500' : 'text-blue-600'
              }`}>
                {arrival.arrives_in_min < 1 ? 'Now' : `${arrival.arrives_in_min} min`}
              </p>
              <p className="text-[10px] text-blue-200 mt-0.5">→</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}