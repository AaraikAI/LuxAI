import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface VendorOnboardingFormData {
  businessName: string;
  legalName: string;
  registrationNumber: string;
  category: string;
  capabilities: string[];
  safetyBadges: string[];
  insuranceCoverage: number;
  insuranceExpiresAt: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  businessEmail: string;
  businessPhone: string;
  taxId: string;
  bankAccount: {
    accountHolderName: string;
    accountNumber: string;
    routingNumber: string;
    accountType: 'checking' | 'savings';
    bankName: string;
  };
}

const VENDOR_CATEGORIES = [
  'Private Aviation',
  'Luxury Hotels',
  'Yachts & Marine',
  'Private Estates',
  'Fine Dining',
  'Exclusive Experiences',
  'Art & Culture',
  'Transportation',
  'Security Services',
  'Wellness & Spa',
];

const SAFETY_BADGES = [
  'ISO 9001 Certified',
  'IATA Certified',
  'Forbes Travel Guide',
  'Leading Hotels of the World',
  'Virtuoso',
  'ARGUS Platinum',
  'Wyvern Wingman',
];

export const VendorOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState<VendorOnboardingFormData>({
    businessName: '',
    legalName: '',
    registrationNumber: '',
    category: '',
    capabilities: [],
    safetyBadges: [],
    insuranceCoverage: 1000000,
    insuranceExpiresAt: '',
    businessAddress: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    },
    businessEmail: '',
    businessPhone: '',
    taxId: '',
    bankAccount: {
      accountHolderName: '',
      accountNumber: '',
      routingNumber: '',
      accountType: 'checking',
      bankName: '',
    },
  });

  const handleCapabilityToggle = (capability: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter((c) => c !== capability)
        : [...prev.capabilities, capability],
    }));
  };

  const handleBadgeToggle = (badge: string) => {
    setFormData((prev) => ({
      ...prev,
      safetyBadges: prev.safetyBadges.includes(badge)
        ? prev.safetyBadges.filter((b) => b !== badge)
        : [...prev.safetyBadges, badge],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.vendors.onboard(formData);
      alert('Vendor onboarding submitted successfully! Your application is under review.');
      navigate('/vendor/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit onboarding application');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Business Information</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Business Name</label>
        <input
          type="text"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Legal Name</label>
        <input
          type="text"
          value={formData.legalName}
          onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Registration Number</label>
        <input
          type="text"
          value={formData.registrationNumber}
          onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Tax ID / EIN</label>
        <input
          type="text"
          value={formData.taxId}
          onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        >
          <option value="">Select a category</option>
          {VENDOR_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Capabilities</label>
        <div className="grid grid-cols-2 gap-2">
          {['International Travel', 'Domestic Travel', '24/7 Concierge', 'Custom Experiences', 'Group Bookings', 'Last-Minute Availability'].map((cap) => (
            <label key={cap} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.capabilities.includes(cap)}
                onChange={() => handleCapabilityToggle(cap)}
                className="rounded"
              />
              <span className="text-sm">{cap}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Contact & Location</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Business Email</label>
        <input
          type="email"
          value={formData.businessEmail}
          onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Business Phone</label>
        <input
          type="tel"
          value={formData.businessPhone}
          onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Street Address</label>
        <input
          type="text"
          value={formData.businessAddress.street}
          onChange={(e) => setFormData({
            ...formData,
            businessAddress: { ...formData.businessAddress, street: e.target.value }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">City</label>
          <input
            type="text"
            value={formData.businessAddress.city}
            onChange={(e) => setFormData({
              ...formData,
              businessAddress: { ...formData.businessAddress, city: e.target.value }
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">State/Province</label>
          <input
            type="text"
            value={formData.businessAddress.state}
            onChange={(e) => setFormData({
              ...formData,
              businessAddress: { ...formData.businessAddress, state: e.target.value }
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Country</label>
          <input
            type="text"
            value={formData.businessAddress.country}
            onChange={(e) => setFormData({
              ...formData,
              businessAddress: { ...formData.businessAddress, country: e.target.value }
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Postal Code</label>
          <input
            type="text"
            value={formData.businessAddress.postalCode}
            onChange={(e) => setFormData({
              ...formData,
              businessAddress: { ...formData.businessAddress, postalCode: e.target.value }
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Insurance & Safety</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Insurance Coverage (USD)</label>
        <input
          type="number"
          min="1000000"
          value={formData.insuranceCoverage}
          onChange={(e) => setFormData({ ...formData, insuranceCoverage: parseInt(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Minimum $1,000,000 required</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Insurance Expiration Date</label>
        <input
          type="date"
          value={formData.insuranceExpiresAt}
          onChange={(e) => setFormData({ ...formData, insuranceExpiresAt: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Safety Badges & Certifications</label>
        <div className="space-y-2">
          {SAFETY_BADGES.map((badge) => (
            <label key={badge} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.safetyBadges.includes(badge)}
                onChange={() => handleBadgeToggle(badge)}
                className="rounded"
              />
              <span className="text-sm">{badge}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Banking Information</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Account Holder Name</label>
        <input
          type="text"
          value={formData.bankAccount.accountHolderName}
          onChange={(e) => setFormData({
            ...formData,
            bankAccount: { ...formData.bankAccount, accountHolderName: e.target.value }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Bank Name</label>
        <input
          type="text"
          value={formData.bankAccount.bankName}
          onChange={(e) => setFormData({
            ...formData,
            bankAccount: { ...formData.bankAccount, bankName: e.target.value }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Account Number</label>
        <input
          type="text"
          value={formData.bankAccount.accountNumber}
          onChange={(e) => setFormData({
            ...formData,
            bankAccount: { ...formData.bankAccount, accountNumber: e.target.value }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Routing Number</label>
        <input
          type="text"
          value={formData.bankAccount.routingNumber}
          onChange={(e) => setFormData({
            ...formData,
            bankAccount: { ...formData.bankAccount, routingNumber: e.target.value }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Account Type</label>
        <select
          value={formData.bankAccount.accountType}
          onChange={(e) => setFormData({
            ...formData,
            bankAccount: { ...formData.bankAccount, accountType: e.target.value as 'checking' | 'savings' }
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          required
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          Your banking information is encrypted and securely stored. We use Stripe Connect for payment processing.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Vendor Onboarding</h1>
          <p className="text-gray-600 mb-8">Join the LuxAI marketplace for luxury travel providers</p>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step <= currentStep ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step}
                </div>
                {step < 4 && <div className={`flex-1 h-1 mx-2 ${
                  step < currentStep ? 'bg-purple-600' : 'bg-gray-200'
                }`} />}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            <div className="flex justify-between mt-8">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Previous
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="ml-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
