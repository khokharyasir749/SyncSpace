import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('syncspace_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hydrate user profile from backend
  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem('syncspace_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
        setToken(savedToken);
      }
    } catch (err) {
      console.error('Failed to restore user session:', err);
      localStorage.removeItem('syncspace_token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    // Listen for global logout events triggered by 401 interceptor
    const handleGlobalLogout = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('syncspace_logout', handleGlobalLogout);
    return () => window.removeEventListener('syncspace_logout', handleGlobalLogout);
  }, [loadUser]);

  /**
   * Helper to extract clear error message from Axios errors
   */
  const extractErrorMessage = (err, defaultMsg) => {
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'Request timed out: The server or database is taking too long to respond. Please verify MongoDB is running.';
    }
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      return 'Network Error: Cannot connect to http://localhost:5000. Please verify the backend server is running.';
    }
    return err.message || defaultMsg;
  };

  /**
   * User login
   */
  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('syncspace_token', newToken);
        setToken(newToken);
        setUser(newUser);
        return { success: true, user: newUser };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const message = extractErrorMessage(err, 'Login failed. Please check your credentials.');
      setError(message);
      return { success: false, message };
    }
  };

  /**
   * User registration
   */
  const register = async ({ name, email, password, avatar }) => {
    setError(null);
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        avatar,
      });

      if (res.data?.success) {
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('syncspace_token', newToken);
        setToken(newToken);
        setUser(newUser);
        return { success: true, user: newUser };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const message = extractErrorMessage(err, 'Registration failed. Please try again.');
      setError(message);
      return { success: false, message };
    }
  };

  /**
   * User profile update
   */
  const updateUserProfile = async ({ name, avatar, statusText }) => {
    setError(null);
    try {
      const res = await api.put('/auth/profile', { name, avatar, statusText });
      if (res.data?.success) {
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Failed to update profile' };
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to update profile');
      setError(message);
      return { success: false, message };
    }
  };

  /**
   * User logout
   */
  const logout = () => {
    localStorage.removeItem('syncspace_token');
    setUser(null);
    setToken(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        setError,
        login,
        register,
        logout,
        updateUserProfile,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
