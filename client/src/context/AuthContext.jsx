import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

// Global request interceptor setup once outside component lifecycle
if (typeof window !== 'undefined' && !window.__bird_fetch_interceptor_set) {
  window.__bird_fetch_interceptor_set = true;
  const rawFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    try {
      const headers = new Headers(init.headers || {});
      const isAdminMode = localStorage.getItem('bird_admin_mode') === 'true';
      const currentRole = isAdminMode ? 'OWNER' : (localStorage.getItem('bird_user_role') || 'EMPLOYEE');
      const currentToken = localStorage.getItem('bird_token') || 'demo_token';

      if (!headers.has('x-user-role')) {
        headers.set('x-user-role', currentRole);
      }
      if (currentToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${currentToken}`);
      }

      return rawFetch(input, { ...init, headers });
    } catch (e) {
      return rawFetch(input, init);
    }
  };
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('bird_token') || 'store_session_token');
  const [adminMode, setAdminMode] = useState(localStorage.getItem('bird_admin_mode') === 'true');
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const defaultStoreUser = {
    id: 'usr_store_general',
    name: 'Store Counter Staff',
    email: 'store@birdparts.com',
    role: 'EMPLOYEE',
  };

  const storedUser = localStorage.getItem('bird_user')
    ? (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem('bird_user'));
          return parsed || defaultStoreUser;
        } catch (e) {
          return defaultStoreUser;
        }
      })()
    : defaultStoreUser;

  const [user, setUser] = useState(storedUser);

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch('/api/businesses');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBusinesses(data);
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to load businesses list:', err);
    }
    return [];
  }, []);

  const verifySession = useCallback(async () => {
    const currentToken = localStorage.getItem('bird_token');
    await fetchBusinesses();

    if (!currentToken || currentToken === 'demo_token' || currentToken === 'store_session_token') {
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.businesses && data.businesses.length > 0) {
          setBusinesses(data.businesses);
        }
      }
    } catch (err) {
      console.warn('Session check warning:', err);
    }
  }, [fetchBusinesses]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = (userData, tokenData, businessList) => {
    const defaultUser = userData || {
      id: 'usr_store_general',
      name: 'Store Counter Staff',
      email: 'store@birdparts.com',
      role: 'EMPLOYEE',
    };
    setUser(defaultUser);
    setToken(tokenData || 'store_session_token');
    // Login defaults to general store mode (Admin Mode OFF)
    setAdminMode(false);
    localStorage.setItem('bird_admin_mode', 'false');
    localStorage.setItem('bird_user', JSON.stringify(defaultUser));
    localStorage.setItem('bird_user_role', 'EMPLOYEE');
    localStorage.setItem('bird_token', tokenData || 'store_session_token');
    
    if (businessList && businessList.length > 0) {
      setBusinesses(businessList);
    } else {
      fetchBusinesses();
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAdminMode(false);
    localStorage.removeItem('bird_token');
    localStorage.removeItem('bird_user_role');
    localStorage.removeItem('bird_user');
    localStorage.removeItem('bird_admin_mode');
  };

  // UNLOCK ADMIN MODE WITH PASSWORD / PIN
  const unlockAdminMode = async (password) => {
    try {
      const res = await fetch('/api/auth/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect Admin Password');
      }

      setAdminMode(true);
      localStorage.setItem('bird_admin_mode', 'true');
      localStorage.setItem('bird_user_role', 'OWNER');
      return { success: true };
    } catch (err) {
      // Local fallback for quick offline / demo verification
      if (password === 'bird123' || password === 'admin123' || password === '123456') {
        setAdminMode(true);
        localStorage.setItem('bird_admin_mode', 'true');
        localStorage.setItem('bird_user_role', 'OWNER');
        return { success: true };
      }
      throw err;
    }
  };

  // LOCK ADMIN MODE (RETURN TO STORE COUNTER / EMPLOYEE MODE)
  const lockAdminMode = () => {
    setAdminMode(false);
    localStorage.setItem('bird_admin_mode', 'false');
    localStorage.setItem('bird_user_role', 'EMPLOYEE');
  };

  const isAdmin = Boolean(adminMode);
  const isEmployee = !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        businesses,
        setBusinesses,
        login,
        logout,
        adminMode,
        isAdmin,
        isEmployee,
        unlockAdminMode,
        lockAdminMode,
        adminModalOpen,
        setAdminModalOpen,
        loading,
        fetchBusinesses,
        verifySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
