import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const BusinessContext = createContext();

export const BusinessProvider = ({ children }) => {
  const { businesses, fetchBusinesses } = useAuth();
  const [activeBusiness, setActiveBusiness] = useState(() => {
    try {
      const savedBusiness = localStorage.getItem('bird_active_business');
      if (savedBusiness) return JSON.parse(savedBusiness);
      const savedId = localStorage.getItem('bird_active_business_id');
      const cached = localStorage.getItem('bird_businesses');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) {
          return list.find(b => b.id === savedId) || list[0];
        }
      }
    } catch {}
    return null;
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const initBusiness = useCallback(async () => {
    let list = businesses;
    if (!list || list.length === 0) {
      list = await fetchBusinesses();
    }

    if (list && list.length > 0) {
      const savedId = localStorage.getItem('bird_active_business_id');
      const found = list.find(b => b.id === savedId) || list[0];
      setActiveBusiness(found);
      try {
        localStorage.setItem('bird_active_business_id', found.id);
        localStorage.setItem('bird_active_business', JSON.stringify(found));
      } catch {}
    }
  }, [businesses, fetchBusinesses]);

  useEffect(() => {
    initBusiness();
  }, [initBusiness]);

  const selectBusiness = (business) => {
    setActiveBusiness(business);
    try {
      localStorage.setItem('bird_active_business_id', business.id);
      localStorage.setItem('bird_active_business', JSON.stringify(business));
    } catch {}
    triggerRefresh();
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <BusinessContext.Provider
      value={{
        activeBusiness,
        activeBusinessId: activeBusiness?.id || '',
        selectBusiness,
        refreshTrigger,
        triggerRefresh,
        fetchBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);
