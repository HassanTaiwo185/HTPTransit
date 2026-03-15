import React, { useState, useEffect, useRef } from 'react';

const OPENCAGE_API_KEY = process.env.REACT_APP_OPENCAGE_API_KEY;

async function geocode(query) {
  if (!query || query.length < 3 || !OPENCAGE_API_KEY) return [];
  try {
    const res  = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=5&no_annotations=1`
    );
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
}

function loadSavedPlaces() {
  try { return JSON.parse(localStorage.getItem('savedPlaces')) || { home: null, work: null, school: null }; }
  catch { return { home: null, work: null, school: null }; }
}
function savePlaces(places) { localStorage.setItem('savedPlaces', JSON.stringify(places)); }

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SearchBar({ onDestinationSelect, onFromSelect }) {
  const [fromQuery,      setFromQuery]      = useState('My Current Location');
  const [toQuery,        setToQuery]        = useState('');
  const [expanded,       setExpanded]       = useState(false);
  const [activeField,    setActiveField]    = useState(null);
  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [savedPlaces,    setSavedPlaces]    = useState(loadSavedPlaces);
  const [settingPlace,   setSettingPlace]   = useState(null);
  const [departureMode,  setDepartureMode]  = useState('now');
  const [departureTime,  setDepartureTime]  = useState(toDatetimeLocal(new Date()));
  const debounceRef = useRef(null);

  const activeQuery = activeField === 'from' ? fromQuery : toQuery;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (activeQuery.length < 3 || activeQuery === 'My Current Location') {
      setResults([]); return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setResults(await geocode(activeQuery));
      setLoading(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [activeQuery]);

  const getDepartureTs = () => {
    if (departureMode === 'now') return null;
    const d = new Date(departureTime);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
  };

  const handleSelect = (result) => {
    const loc = { latitude: result.geometry.lat, longitude: result.geometry.lng, label: result.formatted };
    if (settingPlace) {
      const updated = { ...savedPlaces, [settingPlace]: loc };
      setSavedPlaces(updated); savePlaces(updated);
      setSettingPlace(null); setResults([]); setToQuery('');
      return;
    }
    if (activeField === 'from') {
      setFromQuery(result.formatted); onFromSelect?.(loc);
    } else {
      setToQuery(result.formatted);
      onDestinationSelect?.(loc, getDepartureTs());
    }
    setResults([]); setActiveField(null);
  };

  const handleQuickSelect = (type) => {
    const place = savedPlaces[type];
    if (place) {
      setToQuery(place.label);
      onDestinationSelect?.(place, getDepartureTs());
      setResults([]);
    } else {
      setSettingPlace(type); setToQuery(''); setActiveField('to');
    }
  };

  const handleClose = () => {
    setExpanded(false); setActiveField(null); setResults([]);
    setToQuery(''); setFromQuery('My Current Location');
    setSettingPlace(null); setDepartureMode('now');
  };

  const quickButtons = [
    { key: 'home', label: 'Home' },
    { key: 'work', label: 'Work' },
    { key: 'school', label: 'School' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[950]">

      {/* ── Collapsed pill ── */}
      {!expanded ? (
        <div className="px-4 pb-5 pt-2">
          <button
            onClick={() => { setExpanded(true); setActiveField('to'); }}
            className="w-full bg-white rounded-2xl shadow-xl flex items-center px-4 h-14 gap-3 active:scale-[0.98] transition-transform border border-blue-100 hover:border-blue-300"
          >
            <div className="flex flex-col items-center gap-[3px] shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-px h-3 bg-blue-200" />
              <div className="w-2 h-2 rounded bg-blue-400" />
            </div>
            <span className="text-blue-300 text-[14px] font-medium flex-1 text-left">Where to?</span>
            <div className="bg-blue-600 rounded-xl p-2 shrink-0 shadow-sm shadow-blue-200">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          </button>
        </div>

      ) : (
        /* ── Expanded sheet ── */
        <div className="bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-8 max-h-[85vh] overflow-y-auto border-t border-blue-100">

          <div className="flex justify-center mb-3">
            <div className="w-8 h-1 bg-blue-100 rounded-full" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-gray-900">
              {settingPlace ? `Set your ${settingPlace} address` : 'Plan your trip'}
            </h2>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-400 text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* From / To inputs */}
          <div className="rounded-2xl overflow-hidden border border-blue-200 mb-3 shadow-sm">
            {!settingPlace && (
              <>
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-blue-100 transition-colors ${activeField === 'from' ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <input
                    value={fromQuery}
                    onChange={(e) => setFromQuery(e.target.value)}
                    onFocus={() => setActiveField('from')}
                    placeholder="Starting location…"
                    className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none placeholder-blue-200"
                  />
                  {fromQuery !== 'My Current Location' && (
                    <button
                      onClick={() => { setFromQuery('My Current Location'); onFromSelect?.(null); }}
                      className="text-[11px] text-blue-500 font-semibold bg-blue-50 px-2 py-1 rounded-lg shrink-0 hover:bg-blue-100 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex items-center px-[18px] py-1 bg-white">
                  <div className="flex flex-col gap-[3px]">
                    {[0,1,2].map(k => <div key={k} className="w-px h-1 bg-blue-200 rounded" />)}
                  </div>
                </div>
              </>
            )}
            <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${activeField === 'to' ? 'bg-blue-50' : 'bg-white'}`}>
              <div className="w-2.5 h-2.5 rounded bg-blue-600 shrink-0" />
              <input
                value={toQuery}
                onChange={(e) => setToQuery(e.target.value)}
                onFocus={() => setActiveField('to')}
                placeholder={settingPlace ? `Search for your ${settingPlace}…` : 'Enter destination…'}
                className="flex-1 text-[13px] text-gray-800 bg-transparent outline-none placeholder-blue-200"
                autoFocus
              />
              {toQuery.length > 0 && (
                <button
                  onClick={() => { setToQuery(''); setResults([]); }}
                  className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-400 text-xs shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Departure time selector */}
          {!settingPlace && (
            <div className="mb-4">
              <div className="flex gap-2 mb-2.5">
                {['now', 'scheduled'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDepartureMode(mode)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${
                      departureMode === mode
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'bg-white border-blue-100 text-blue-400 hover:border-blue-300'
                    }`}
                  >
                    {mode === 'now' ? 'Leave Now' : 'Schedule'}
                  </button>
                ))}
              </div>

              {departureMode === 'scheduled' && (
                <div className="rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                  <input
                    type="datetime-local"
                    value={departureTime}
                    min={toDatetimeLocal(new Date())}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-4 py-3 text-[13px] text-gray-800 bg-white outline-none"
                  />
                </div>
              )}

              <p className="text-[11px] text-blue-300 mt-1.5 px-1">
                {departureMode === 'now'
                  ? 'Crowding based on live bus scan if available, otherwise ML prediction'
                  : 'Crowding will be predicted using ML model for the selected time'}
              </p>
            </div>
          )}

          {/* Autocomplete results */}
          {(results.length > 0 || loading) && (
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm mb-4 overflow-hidden max-h-48 overflow-y-auto">
              {loading && (
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-blue-300">Searching…</span>
                </div>
              )}
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-blue-50 border-b border-blue-50 last:border-none transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-200 shrink-0" />
                  <span className="text-[13px] text-gray-700 truncate">{r.formatted}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick buttons */}
          {!settingPlace && (
            <div className="flex gap-2 mb-4">
              {quickButtons.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleQuickSelect(key)}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 border transition-all ${
                    savedPlaces[key]
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-white border-blue-100 text-blue-400 hover:border-blue-300'
                  }`}
                >
                  <span className={`text-[10px] font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
                    savedPlaces[key] ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-400'
                  }`}>
                    {label[0]}
                  </span>
                  <span className="text-[11px] font-semibold">
                    {savedPlaces[key] ? label : `Set ${label}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {settingPlace && (
            <button
              onClick={() => { setSettingPlace(null); setToQuery(''); setResults([]); }}
              className="w-full py-2.5 rounded-xl border border-blue-100 text-blue-400 text-[13px] font-medium hover:bg-blue-50 transition-colors mb-3"
            >
              Back
            </button>
          )}

          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl bg-blue-50 text-blue-400 text-[13px] font-medium hover:bg-blue-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}