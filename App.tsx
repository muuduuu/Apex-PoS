import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { SalesPage } from './components/SalesPage';
import { Dashboard } from './components/Dashboard';
import { User } from './types';
import { apiClient } from './services/apiClient';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // ✅ PERSISTENT SESSION CHECK - Runs on EVERY page load
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        
        // 1. Try to get current user from backend session
        // Backend checks cookie → returns user if valid
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/me`, {
          credentials: 'include', // Sends session cookie
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setError('');
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout(); // Clears backend session
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="text-slate-600 font-semibold">Checking session...</p>
        </div>
      </div>
    );
  }

  // Show login if no user
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Role-based routing
  if (user.role === 'admin') {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  if (user.role === 'cashier') {
    return <SalesPage user={user} onLogout={handleLogout} />;
  }

  // Unknown role
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
        <p className="text-slate-600 mb-4">Unknown user role: {user.role}</p>
        <button
          onClick={handleLogout}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
};


export default App;
