import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Shield, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';

export default function KYCVerificationPage() {
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const response: any = await api.kyc.getMyStatus();
      setKycStatus(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load KYC status');
    } finally {
      setLoading(false);
    }
  };

  const initiateVerification = async () => {
    setInitiating(true);
    try {
      const response: any = await api.kyc.initiate({ provider: 'persona' });
      setVerificationUrl(response.data.verificationUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate verification');
    } finally {
      setInitiating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-luxury-600">Loading verification status...</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (!kycStatus) return <AlertCircle className="h-16 w-16 text-gray-400" />;

    switch (kycStatus.kycStatus) {
      case 'verified':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-16 w-16 text-gold-500" />;
      case 'rejected':
        return <AlertCircle className="h-16 w-16 text-red-500" />;
      default:
        return <Shield className="h-16 w-16 text-luxury-500" />;
    }
  };

  const getStatusMessage = () => {
    if (!kycStatus) return 'Verification Required';

    switch (kycStatus.kycStatus) {
      case 'verified':
        return 'Identity Verified';
      case 'in_progress':
        return 'Verification In Progress';
      case 'rejected':
        return 'Verification Failed';
      default:
        return 'Verification Pending';
    }
  };

  const getStatusDescription = () => {
    if (!kycStatus) {
      return 'To access the full luxury travel experience, please complete your identity verification.';
    }

    switch (kycStatus.kycStatus) {
      case 'verified':
        return 'Your identity has been successfully verified. You have full access to all features.';
      case 'in_progress':
        return 'Your verification is being processed. This typically takes 1-2 business days.';
      case 'rejected':
        return 'We were unable to verify your identity. Please contact support or try again.';
      default:
        return 'Please complete the verification process to unlock all features.';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-luxury-900 mb-2">
          Identity Verification
        </h1>
        <p className="text-luxury-600">
          Secure, compliant, and confidential verification process
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="card text-center">
        <div className="mb-6">{getStatusIcon()}</div>

        <h2 className="text-2xl font-semibold text-luxury-900 mb-2">
          {getStatusMessage()}
        </h2>

        <p className="text-luxury-600 mb-8 max-w-2xl mx-auto">
          {getStatusDescription()}
        </p>

        {kycStatus?.kycStatus === 'verified' && kycStatus.kycVerifiedAt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-700">
              Verified on {new Date(kycStatus.kycVerifiedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {(!kycStatus || kycStatus.kycStatus === 'pending') && !verificationUrl && (
          <button
            onClick={initiateVerification}
            disabled={initiating}
            className="btn-gold inline-flex items-center"
          >
            <Shield className="h-5 w-5 mr-2" />
            {initiating ? 'Starting Verification...' : 'Start Verification'}
          </button>
        )}

        {verificationUrl && (
          <div className="bg-luxury-50 border border-luxury-200 rounded-lg p-6">
            <h3 className="font-semibold text-luxury-900 mb-4">
              Ready to Verify
            </h3>
            <p className="text-sm text-luxury-600 mb-6">
              Click the button below to start your secure verification process. You'll need:
            </p>
            <ul className="text-sm text-luxury-700 mb-6 text-left max-w-md mx-auto space-y-2">
              <li>• Government-issued ID (passport or driver's license)</li>
              <li>• Proof of address (utility bill or bank statement)</li>
              <li>• Net worth documentation (for UHNW verification)</li>
              <li>• 5-10 minutes of your time</li>
            </ul>
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Continue to Verification
            </a>
          </div>
        )}

        {kycStatus?.kycStatus === 'rejected' && (
          <div className="mt-6">
            <button
              onClick={initiateVerification}
              disabled={initiating}
              className="btn-secondary inline-flex items-center"
            >
              Try Again
            </button>
            <p className="text-sm text-luxury-600 mt-4">
              Or <a href="mailto:support@luxai.example.com" className="text-gold-600 hover:text-gold-700">contact support</a> for assistance
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-6">
        <div className="card text-center">
          <Shield className="h-8 w-8 text-luxury-700 mx-auto mb-3" />
          <h3 className="font-semibold text-luxury-900 mb-2">Secure & Encrypted</h3>
          <p className="text-sm text-luxury-600">
            Your data is encrypted and stored securely with bank-level security
          </p>
        </div>

        <div className="card text-center">
          <CheckCircle className="h-8 w-8 text-luxury-700 mx-auto mb-3" />
          <h3 className="font-semibold text-luxury-900 mb-2">Fully Compliant</h3>
          <p className="text-sm text-luxury-600">
            We comply with all KYC/AML regulations and data protection laws
          </p>
        </div>

        <div className="card text-center">
          <Clock className="h-8 w-8 text-luxury-700 mx-auto mb-3" />
          <h3 className="font-semibold text-luxury-900 mb-2">Quick Process</h3>
          <p className="text-sm text-luxury-600">
            Most verifications complete within 1-2 business days
          </p>
        </div>
      </div>
    </div>
  );
}
