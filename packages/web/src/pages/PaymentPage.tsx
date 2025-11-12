import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface PaymentDetails {
  quoteId: string;
  amount: number;
  currency: string;
  description: string;
  requiresEscrow: boolean;
}

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);

  const quoteId = searchParams.get('quoteId') || '';
  const amount = parseFloat(searchParams.get('amount') || '0');
  const description = searchParams.get('description') || 'Luxury Travel Service';
  const currency = searchParams.get('currency') || 'usd';
  const requiresEscrow = amount > 50000;

  const handleCreatePaymentIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.payments.createIntent({
        quoteId,
        amount,
        currency,
      });

      setPaymentIntent(response.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to create payment intent');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentIntent) return;

    setLoading(true);
    setError(null);

    try {
      await api.payments.confirmPayment(paymentIntent.paymentIntentId);
      alert('Payment successful!');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Secure Payment</h1>
          <p className="text-gray-600 mb-8">Complete your luxury travel booking</p>

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-medium">{description}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium">${amount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Currency</span>
                <span className="font-medium uppercase">{currency}</span>
              </div>

              {requiresEscrow && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 text-xl">🔒</span>
                    <div>
                      <p className="font-medium text-green-800">Escrow Protection Active</p>
                      <p className="text-sm text-gray-600 mt-1">
                        For transactions over $50,000, your payment is held in secure escrow until
                        services are delivered. This provides maximum protection for high-value bookings.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Flow */}
          {!paymentIntent ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Information</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  Your payment will be processed securely through Stripe. We never store your card details.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {/* Payment Features */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center space-x-3">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">PCI DSS Level 1 Certified</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">256-bit SSL Encryption</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">3D Secure Authentication</span>
                </div>
                {requiresEscrow && (
                  <div className="flex items-center space-x-3">
                    <span className="text-green-600">✓</span>
                    <span className="text-gray-700 font-medium">Escrow Protection for Large Transactions</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreatePaymentIntent}
                disabled={loading || !quoteId || amount <= 0}
                className="w-full py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4">Confirm Payment</h3>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-900">
                  Payment intent created successfully. Click confirm to complete the transaction.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {/* Payment Intent Details */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h4 className="font-semibold mb-3">Payment Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID</span>
                    <span className="font-mono">{paymentIntent.paymentIntentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-semibold">${amount.toLocaleString()}</span>
                  </div>
                  {paymentIntent.requiresEscrow && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Escrow Status</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Protected
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {paymentIntent.requiresEscrow && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Escrow Protection Terms</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Funds are held securely until service delivery</li>
                    <li>• Vendor receives payment only after confirmation</li>
                    <li>• Full refund protection if service is not delivered</li>
                    <li>• Dispute resolution available through our concierge team</li>
                  </ul>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => setPaymentIntent(null)}
                  disabled={loading}
                  className="flex-1 py-4 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Trust Badges */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-8 text-gray-400">
              <div className="text-center">
                <p className="text-xs">Powered by</p>
                <p className="font-semibold">Stripe</p>
              </div>
              <div className="text-center">
                <p className="text-xs">PCI DSS</p>
                <p className="font-semibold">Level 1</p>
              </div>
              <div className="text-center">
                <p className="text-xs">SSL</p>
                <p className="font-semibold">256-bit</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Link */}
        <div className="mt-6 text-center">
          <a
            href="/payments/history"
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            View Payment History →
          </a>
        </div>
      </div>
    </div>
  );
};
