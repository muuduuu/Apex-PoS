import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { User } from '../types';
import { Lock, User as UserIcon } from 'lucide-react';
import LogoImage from '../src/images/sabic international logo.png';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ apiClient.login() now returns { user, token }
      const result = await apiClient.login(username, password);
      
      if (result) {
        // ✅ Token already stored in localStorage by apiClient.login()
        // Just pass the user to onLogin
        onLogin(result.user);
      } else {
        // Invalid credentials (401)
        setError('Invalid username or password');
      }
    } catch (err) {
      // Other errors (network, server error, etc.)
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during login';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">

        <div className="bg-white pt-8 px-8 py-8 pb-0 text-center">
          <img src={LogoImage} alt="Logo" className="mx-auto mb-4 h-20" />

        </div>

        {/* Title */}
        <div className="bg-slate-50 text-center py-4">
          <p className="text-black font-semibold text-lg">System Login</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                {error}
              </div>
            )}
            
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#3d579d] focus:border-[#3d579d] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#3d579d] focus:border-[#3d579d] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all ${
                loading 
                  ? 'bg-slate-400 cursor-wait' 
                  : !username || !password
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-[#3d579d] hover:bg-[#2f4377] hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-[#3d579d]'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">📋 Demo Credentials:</p>
            <div className="space-y-1 text-xs">
              <p><span className="font-medium text-slate-600">Admin:</span> <code className="bg-white px-2 py-1 rounded">admin</code> / <code className="bg-white px-2 py-1 rounded">admin123</code></p>
              <p><span className="font-medium text-slate-600">Cashier:</span> <code className="bg-white px-2 py-1 rounded">cashier1</code> / <code className="bg-white px-2 py-1 rounded">cashier123</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
