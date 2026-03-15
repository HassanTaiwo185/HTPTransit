import React, { useState, useEffect, useRef } from 'react';
import MapView from './components/MapView';
import SearchBar from './components/SearchBar';
import ArrivalSheet from './components/ArrivalSheet';
import TripPlanSheet from './components/TripPlanSheet';
import RouteStopSheet from './components/RouteStopSheet';
import NotificationToast from './components/NotificationToast';
import useNearbyStops from './hooks/useNearbyStops';
import useArrivals from './hooks/useArrivals';
import usePlan from './hooks/usePlan';
import useLiveStop from './hooks/useLiveStop';
import { getTripStops, getVehiclePositions } from './services/api';

function App() {
  const [location, setLocation]                   = useState(null);
  const [destination, setDestination]             = useState(null);
  const [departureTime, setDepartureTime]         = useState(null);
  const [selectedStop, setSelectedStop]           = useState(null);
  const [showPlan, setShowPlan]                   = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [selectedLeg, setSelectedLeg]             = useState(null);
  const [selectedWalkLeg, setSelectedWalkLeg]     = useState(null);
  const [tripStops, setTripStops]                 = useState([]);
  const [vehicles, setVehicles]                   = useState([]);
  const vehicleIntervalRef                        = useRef(null);

  // get user location — once only
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        );
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => setLocation({ latitude: 43.8971, longitude: -78.8658 })
        );
      }
    });
  }, []);

  const { stops } = useNearbyStops(location?.latitude, location?.longitude);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stops.length > 0 && !selectedStop) setSelectedStop(stops[0]);
  }, [stops]);

  // arrivals — only fetched once when stop selected, NOT polling
  const { arrivals, loading: arrivalsLoading } = useArrivals(selectedStop?.stop_id);

  // WebSocket live updates — only active when arrival sheet is visible
  const isArrivalSheetVisible = !!(selectedStop && !showPlan && !selectedLeg);
  const { crowding, notifications } = useLiveStop(
    isArrivalSheetVisible ? selectedStop?.stop_id : null
  );

  const { plans, loading: planLoading, error: planError, fetchPlan, clearPlan } = usePlan();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (destination && location) {
      fetchPlan(
        location.latitude,
        location.longitude,
        destination.latitude,
        destination.longitude,
        departureTime,
      );
      setShowPlan(true);
    }
  }, [destination, departureTime]);

  // fetch trip stops for polyline — only when leg selected
  useEffect(() => {
    if (!selectedLeg?.trip_id) { setTripStops([]); return; }
    getTripStops(selectedLeg.trip_id, selectedLeg.start_time, selectedLeg.route)
      .then(data => setTripStops(data.stops || []))
      .catch(() => setTripStops([]));
  }, [selectedLeg]);

  // vehicle polling — only when leg open, every 60s, stop immediately on close
  useEffect(() => {
    if (vehicleIntervalRef.current) {
      clearInterval(vehicleIntervalRef.current);
      vehicleIntervalRef.current = null;
    }

    if (!selectedLeg?.global_route_id) {
      setVehicles([]);
      return;
    }

    // initial fetch
    getVehiclePositions(selectedLeg.global_route_id)
      .then(data => setVehicles(data.vehicles || []))
      .catch(() => setVehicles([]));

    // poll every 60s — only 1 call/min
    vehicleIntervalRef.current = setInterval(() => {
      getVehiclePositions(selectedLeg.global_route_id)
        .then(data => setVehicles(data.vehicles || []))
        .catch(() => {});
    }, 60000);

    return () => {
      if (vehicleIntervalRef.current) {
        clearInterval(vehicleIntervalRef.current);
        vehicleIntervalRef.current = null;
      }
    };
  }, [selectedLeg?.global_route_id]);

  const handleArrivalSelect = (arrival) => {
    const startTime = Math.floor(Date.now() / 1000) + Math.round(arrival.arrives_in_min * 60);
    setSelectedLeg({
      route:           arrival.route_short_name,
      route_color:     arrival.route_color || '#3b82f6',
      global_route_id: arrival.global_route_id || null,
      trip_id:         arrival.trip_id,
      start_time:      startTime,
      is_real_time:    arrival.is_real_time || false,
      headsign:        arrival.headsign,
      duration_min:    0,
      stop_times:      [],
      next_departures: arrival.next_departures || [],
      polyline:        '',
    });
  };


  


  

  const handleClosePlan = () => {
    setShowPlan(false);
    clearPlan();
    setDestination(null);
    setDepartureTime(null);
    setSelectedPlanIndex(0);
    setSelectedLeg(null);
    setSelectedWalkLeg(null);
    setTripStops([]);
    setVehicles([]);
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">

      <MapView
        location={location}
        stops={[]}
        selectedStop={null}
        onStopClick={null}
        plans={showPlan ? plans : []}
        selectedPlanIndex={selectedPlanIndex}
        selectedLeg={selectedLeg}
        tripStops={tripStops}
        walkLeg={selectedWalkLeg}
        vehicles={vehicles}
      />

      <NotificationToast notifications={notifications} />

      {selectedLeg && (
        <RouteStopSheet
          leg={selectedLeg}
          vehicles={vehicles}
          onClose={() => {
            setSelectedLeg(null);
            setTripStops([]);
            setVehicles([]);
          }}
        />
      )}

      {showPlan && !selectedLeg && (
        <TripPlanSheet
          plans={plans}
          loading={planLoading}
          error={planError}
          selectedPlanIndex={selectedPlanIndex}
          onPlanSelect={(i) => { setSelectedPlanIndex(i); setSelectedWalkLeg(null); }}
          onLegSelect={(leg) => setSelectedLeg(leg)}
          onWalkLegSelect={(leg) => setSelectedWalkLeg(
            selectedWalkLeg?.start_time === leg.start_time ? null : leg
          )}
          selectedWalkLeg={selectedWalkLeg}
          onClose={handleClosePlan}
        />
      )}

      {selectedStop && !showPlan && !selectedLeg && (
        <ArrivalSheet
          stop={selectedStop}
          arrivals={arrivals}
          crowding={crowding}
          loading={arrivalsLoading}
          onClose={() => setSelectedStop(null)}
          onArrivalSelect={handleArrivalSelect}
        />
      )}

      {!showPlan && !selectedLeg && (
        <SearchBar
          onDestinationSelect={(dest, depTs) => {
            setDepartureTime(depTs ?? null);
            setDestination(dest);
          }}
          onFromSelect={(from) => { if (from) setLocation(from); }}
        />
      )}
    </div>
  );
}

export default App;