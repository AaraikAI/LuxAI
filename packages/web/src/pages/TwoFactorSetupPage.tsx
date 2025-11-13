import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Shield, Download, Eye, EyeOff, Check, X } from 'lucide-react';

export default function TwoFactorSetupPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  // Setup state
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);

  // Disable state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const response: any = await api.twoFactor.getStatus();
      setIsEnabled(response.data.enabled);
    } catch (err: any) {
      setError(err.message || 'Failed to check 2FA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response: any = await api.twoFactor.setup();
      setSetupData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;

    try {
      setLoading(true);
      setError('');
      await api.twoFactor.enable({
        secret: setupData.secret,
        verificationCode,
        backupCodes: setupData.backupCodes,
      });

      setSuccess('Two-factor authentication enabled successfully!');
      setIsEnabled(true);
      setShowBackupCodes(true);
      setVerificationCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to enable 2FA. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      await api.twoFactor.disable({ verificationCode: disableCode });

      setSuccess('Two-factor authentication has been disabled');
      setIsEnabled(false);
      setShowDisableConfirm(false);
      setDisableCode('');
      setSetupData(null);
    } catch (err: any) {
      setError(err.message || 'Failed to disable 2FA. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const text = `LuxAI Designer - Two-Factor Authentication Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\n${setupData.backupCodes.join('\n')}\n\nStore these codes in a safe place. Each code can only be used once.`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luxai-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSavedBackupCodes(true);
  };

  if (loading && !setupData) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto mb-4"></div>
          <p className="text-luxury-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gold-100 rounded-lg">
          <Shield className="h-6 w-6 text-gold-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-luxury-900">Two-Factor Authentication</h1>
          <p className="text-luxury-600">Add an extra layer of security to your account</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
          <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
          <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Current Status */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-luxury-900 mb-4">Current Status</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <>
                <div className="p-2 bg-green-100 rounded-full">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-luxury-900">2FA is Enabled</p>
                  <p className="text-sm text-luxury-600">Your account is protected with two-factor authentication</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 bg-slate-100 rounded-full">
                  <Shield className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-luxury-900">2FA is Disabled</p>
                  <p className="text-sm text-luxury-600">Protect your account by enabling two-factor authentication</p>
                </div>
              </>
            )}
          </div>

          {!isEnabled && !setupData && (
            <button onClick={handleSetup} className="btn-primary">
              Enable 2FA
            </button>
          )}

          {isEnabled && !showDisableConfirm && (
            <button onClick={() => setShowDisableConfirm(true)} className="btn-secondary text-red-600 hover:bg-red-50">
              Disable 2FA
            </button>
          )}
        </div>
      </div>

      {/* Disable 2FA */}
      {showDisableConfirm && (
        <div className="card mb-6 border-2 border-red-200">
          <h2 className="text-xl font-semibold text-red-900 mb-4">Disable Two-Factor Authentication</h2>
          <p className="text-luxury-600 mb-6">
            Enter your current authentication code to disable 2FA. This will make your account less secure.
          </p>

          <form onSubmit={handleDisable} className="space-y-4">
            <div>
              <label htmlFor="disableCode" className="block text-sm font-medium text-luxury-700 mb-2">
                Authentication Code
              </label>
              <input
                type="text"
                id="disableCode"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="input max-w-xs text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableConfirm(false);
                  setDisableCode('');
                  setError('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Setup 2FA */}
      {setupData && !isEnabled && (
        <>
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-luxury-900 mb-6">Step 1: Scan QR Code</h2>
            <p className="text-luxury-600 mb-6">
              Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to scan this QR code.
            </p>

            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-64 h-64" />
              </div>
              <div className="text-center">
                <p className="text-sm text-luxury-600 mb-2">Or enter this key manually:</p>
                <code className="bg-slate-100 px-4 py-2 rounded text-sm font-mono">{setupData.secret}</code>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-luxury-900 mb-6">Step 2: Verify Code</h2>
            <p className="text-luxury-600 mb-6">
              Enter the 6-digit code from your authenticator app to verify the setup.
            </p>

            <form onSubmit={handleEnable} className="space-y-4">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-luxury-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="input max-w-xs text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Enabling...' : 'Enable 2FA'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Backup Codes */}
      {showBackupCodes && setupData && (
        <div className="card border-2 border-gold-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-luxury-900 mb-2">Backup Codes</h2>
              <p className="text-luxury-600">
                Save these backup codes in a safe place. Each code can only be used once.
              </p>
            </div>
            <button
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              className="text-luxury-600 hover:text-luxury-900"
            >
              {showBackupCodes ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {showBackupCodes && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 rounded-lg">
                {setupData.backupCodes.map((code, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-slate-400">{index + 1}.</span>
                    <code className="font-mono font-semibold text-luxury-900">{code}</code>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={downloadBackupCodes}
                  className="btn-secondary w-full sm:w-auto flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Backup Codes
                </button>

                {!savedBackupCodes && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                    <strong>Important:</strong> Download and save these codes now. You won't be able to see them again!
                  </div>
                )}

                {savedBackupCodes && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Backup codes saved! You can now close this page.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Information */}
      {!setupData && !isEnabled && (
        <div className="card bg-blue-50 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">What is Two-Factor Authentication?</h3>
          <p className="text-blue-800 text-sm mb-4">
            Two-factor authentication (2FA) adds an extra layer of security to your account by requiring both your password
            and a verification code from your phone when signing in.
          </p>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Protects your account even if your password is compromised</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Works with popular authenticator apps</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Includes backup codes for account recovery</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
