import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import SearchBar from './components/SearchBar';

function App() {
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocation({ latitude: 43.6532, longitude: -79.3832 })
    );
  }, []);

  console.log('FROM:', location);       // ready to send
  console.log('TO:', destination); 

  return (
    <div className="w-screen h-screen relative">
      <MapView location={location} destination={destination} />
      <SearchBar
        onDestinationSelect={(dest) => setDestination(dest)}
        onFromSelect={(from) => setLocation(from)}
      />
    </div>
  );
}

export default App;