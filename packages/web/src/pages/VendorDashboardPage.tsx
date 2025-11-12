import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface VendorProfile {
  id: string;
  businessName: string;
  category: string;
  onboardingStatus: string;
  kybStatus: string;
  stripeAccountId: string | null;
}

interface Deal {
  id: string;
  title: string;
  category: string;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  isExclusive: boolean;
  isOffMarket: boolean;
  status: string;
  createdAt: string;
}

interface Analytics {
  totalDeals: number;
  activeDeals: number;
  totalViews: number;
  totalInquiries: number;
  conversionRate: number;
  totalRevenue: number;
  averageDealValue: number;
}

export const VendorDashboardPage: React.FC = () => {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'analytics'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [profileRes, dealsRes, analyticsRes] = await Promise.all([
        api.vendors.getProfile(),
        api.vendors.getDeals(),
        api.vendors.getAnalytics(),
      ]);

      setProfile(profileRes.data);
      setDeals(dealsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Vendor Profile Found</h2>
          <p className="text-gray-600 mb-6">
            Complete the vendor onboarding process to access your dashboard.
          </p>
          <a
            href="/vendor/onboard"
            className="block w-full text-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Start Onboarding
          </a>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Onboarding Status</h3>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              profile.onboardingStatus === 'approved' ? 'bg-green-100 text-green-800' :
              profile.onboardingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {profile.onboardingStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">KYB Status</h3>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              profile.kybStatus === 'verified' ? 'bg-green-100 text-green-800' :
              profile.kybStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {profile.kybStatus}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Stripe Account</h3>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              profile.stripeAccountId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {profile.stripeAccountId ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Total Deals</p>
            <p className="text-3xl font-bold text-purple-600">{analytics.totalDeals}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Active Deals</p>
            <p className="text-3xl font-bold text-green-600">{analytics.activeDeals}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Total Views</p>
            <p className="text-3xl font-bold text-blue-600">{analytics.totalViews}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Inquiries</p>
            <p className="text-3xl font-bold text-orange-600">{analytics.totalInquiries}</p>
          </div>
        </div>
      )}

      {/* Recent Deals */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Deals</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {deals.slice(0, 5).map((deal) => (
            <div key={deal.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-lg mb-1">{deal.title}</h4>
                  <p className="text-sm text-gray-500 mb-2">{deal.category}</p>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-gray-700">
                      ${deal.priceRange.min.toLocaleString()} - ${deal.priceRange.max.toLocaleString()}
                    </span>
                    {deal.isExclusive && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">Exclusive</span>
                    )}
                    {deal.isOffMarket && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Off-Market</span>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  deal.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {deal.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-50 text-center">
          <button
            onClick={() => setActiveTab('deals')}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            View All Deals →
          </button>
        </div>
      </div>
    </div>
  );

  const renderDeals = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Deals</h2>
        <a
          href="/vendor/deals/create"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Create New Deal
        </a>
      </div>

      <div className="grid gap-6">
        {deals.map((deal) => (
          <div key={deal.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">{deal.title}</h3>
                <p className="text-gray-600 mb-3">{deal.category}</p>
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-medium text-purple-600">
                    ${deal.priceRange.min.toLocaleString()} - ${deal.priceRange.max.toLocaleString()}
                  </span>
                  {deal.isExclusive && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      Exclusive
                    </span>
                  )}
                  {deal.isOffMarket && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                      Off-Market
                    </span>
                  )}
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                deal.status === 'active' ? 'bg-green-100 text-green-800' :
                deal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {deal.status}
              </span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                Created {new Date(deal.createdAt).toLocaleDateString()}
              </span>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg">
                  Edit
                </button>
                <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                  View Stats
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics</h2>

      {analytics && (
        <>
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-2">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ${analytics.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-2">Average Deal Value</p>
              <p className="text-2xl font-bold text-blue-600">
                ${analytics.averageDealValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-2">Conversion Rate</p>
              <p className="text-2xl font-bold text-purple-600">
                {analytics.conversionRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-2">Total Inquiries</p>
              <p className="text-2xl font-bold text-orange-600">
                {analytics.totalInquiries}
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Deal Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <span className="text-gray-700">Total Deals</span>
                <span className="font-semibold">{analytics.totalDeals}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <span className="text-gray-700">Active Deals</span>
                <span className="font-semibold text-green-600">{analytics.activeDeals}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <span className="text-gray-700">Total Views</span>
                <span className="font-semibold">{analytics.totalViews}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-700">Views per Deal</span>
                <span className="font-semibold">
                  {analytics.totalDeals > 0 ? (analytics.totalViews / analytics.totalDeals).toFixed(1) : '0'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-2">{profile.businessName}</h1>
          <p className="text-gray-600">{profile.category}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-2 font-medium ${
              activeTab === 'overview'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('deals')}
            className={`pb-4 px-2 font-medium ${
              activeTab === 'deals'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Deals ({deals.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-4 px-2 font-medium ${
              activeTab === 'analytics'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'deals' && renderDeals()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};
