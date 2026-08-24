import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBusiness } from './BusinessContext';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const { activeBusinessId } = useBusiness();
  const [locations, setLocations] = useState([]);
  const [activeLocationId, setActiveLocationId] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeBusinessId) {
      fetchLocations();
    } else {
      setLocations([]);
    }
  }, [activeBusinessId]);

  const fetchLocations = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/locations?businessId=${activeBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setLocations(data);

        // Restore saved location if valid for this business
        const savedId = localStorage.getItem(`bird_location_${activeBusinessId}`);
        if (savedId && (savedId === 'ALL' || data.some(l => l.id === savedId))) {
          setActiveLocationId(savedId);
        } else {
          setActiveLocationId('ALL');
        }
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (id) => {
    setActiveLocationId(id);
    if (activeBusinessId) {
      localStorage.setItem(`bird_location_${activeBusinessId}`, id);
    }
  };

  const activeLocation = activeLocationId === 'ALL'
    ? null
    : locations.find(l => l.id === activeLocationId) || null;

  return (
    <LocationContext.Provider
      value={{
        locations,
        activeLocationId,
        activeLocation,
        selectLocation,
        setActiveLocationId: selectLocation,
        refreshLocations: fetchLocations,
        loading,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
