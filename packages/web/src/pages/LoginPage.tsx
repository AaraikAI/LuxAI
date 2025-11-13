import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response: any = await api.auth.login({ email, password });

      // Check if 2FA is required
      if (response.data.requiresTwoFactor) {
        setTempToken(response.data.tempToken);
        setShowTwoFactor(true);
        setError('');
      } else {
        // Normal login without 2FA
        setAuth(response.data.user, response.data.token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response: any = await api.auth.verify2FA({
        tempToken,
        code: twoFactorCode,
        isBackupCode,
      });

      setAuth(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid authentication code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="card">
          {!showTwoFactor ? (
            <>
              <h2 className="text-3xl font-bold text-center text-luxury-900 mb-8">
                Welcome Back
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-luxury-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-luxury-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-luxury-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-gold-600 hover:text-gold-700 font-medium">
                  Create one now
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-center text-luxury-900 mb-4">
                Two-Factor Authentication
              </h2>
              <p className="text-center text-luxury-600 mb-8">
                Enter the 6-digit code from your authenticator app
                {!isBackupCode && ' or use a backup code'}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-luxury-700 mb-2">
                    {isBackupCode ? 'Backup Code' : 'Authentication Code'}
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                    className="input text-center text-2xl tracking-widest"
                    placeholder={isBackupCode ? 'XXXX-XXXX' : '000000'}
                    maxLength={isBackupCode ? 9 : 6}
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsBackupCode(!isBackupCode)}
                  className="w-full text-sm text-gold-600 hover:text-gold-700 font-medium"
                >
                  {isBackupCode ? 'Use authenticator code instead' : 'Use backup code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTwoFactor(false);
                    setTwoFactorCode('');
                    setError('');
                  }}
                  className="w-full text-sm text-luxury-600 hover:text-luxury-700"
                >
                  Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
