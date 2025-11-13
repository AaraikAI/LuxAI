import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { TrendingUp, Users, DollarSign, MapPin, Star, Calendar, Plane, Building2 } from 'lucide-react';

interface UserAnalytics {
  totalTrips: number;
  totalSpent: number;
  carbonFootprint: number;
  favoriteDestinations: Array<{ destination: string; tripCount: number }>;
  preferredVendors: Array<{ vendorName: string; bookingCount: number }>;
  averageTripCost: number;
  upcomingTrips: number;
}

interface VendorAnalytics {
  totalDeals: number;
  totalRevenue: number;
  conversionRate: number;
  averageRating: number;
  totalViews: number;
  totalQuotes: number;
  topPerformingDeals: Array<{ title: string; revenue: number }>;
  customerSatisfaction: number;
}

interface PlatformAnalytics {
  totalUsers: number;
  totalVendors: number;
  totalRevenue: number;
  totalBookings: number;
  activeUsers: number;
  newUsersThisMonth: number;
  revenueGrowth: number;
  topDestinations: Array<{ destination: string; bookingCount: number }>;
  topVendors: Array<{ vendorName: string; revenue: number }>;
}

export function AnalyticsDashboardPage() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'user' | 'vendor' | 'platform'>('user');
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [vendorAnalytics, setVendorAnalytics] = useState<VendorAnalytics | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [viewMode, user]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      if (viewMode === 'user') {
        const response = await api.analytics.getUserAnalytics(user.id);
        setUserAnalytics(response.data);
      } else if (viewMode === 'vendor' && user.role === 'vendor') {
        const response = await api.analytics.getVendorAnalytics(user.id);
        setVendorAnalytics(response.data);
      } else if (viewMode === 'platform' && user.role === 'admin') {
        const response = await api.analytics.getPlatformAnalytics();
        setPlatformAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, trend, className = '' }: any) => (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-lg">
          <Icon className="h-6 w-6 text-slate-700" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Analytics Dashboard</h1>
        <p className="text-slate-600">Track your performance and insights</p>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('user')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'user'
              ? 'bg-gold-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          My Analytics
        </button>
        {user?.role === 'vendor' && (
          <button
            onClick={() => setViewMode('vendor')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'vendor'
                ? 'bg-gold-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Vendor Analytics
          </button>
        )}
        {user?.role === 'admin' && (
          <button
            onClick={() => setViewMode('platform')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'platform'
                ? 'bg-gold-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Platform Analytics
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
          <p className="text-slate-600 mt-4">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* User Analytics */}
          {viewMode === 'user' && userAnalytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={Plane}
                  label="Total Trips"
                  value={userAnalytics.totalTrips}
                />
                <StatCard
                  icon={DollarSign}
                  label="Total Spent"
                  value={`$${userAnalytics.totalSpent.toLocaleString()}`}
                />
                <StatCard
                  icon={Calendar}
                  label="Upcoming Trips"
                  value={userAnalytics.upcomingTrips}
                />
                <StatCard
                  icon={DollarSign}
                  label="Avg Trip Cost"
                  value={`$${userAnalytics.averageTripCost.toLocaleString()}`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gold-600" />
                    Favorite Destinations
                  </h3>
                  <div className="space-y-3">
                    {userAnalytics.favoriteDestinations.map((dest, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-slate-700">{dest.destination}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-gold-600 h-2 rounded-full"
                              style={{
                                width: `${(dest.tripCount / userAnalytics.favoriteDestinations[0].tripCount) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-slate-900 w-8 text-right">
                            {dest.tripCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-gold-600" />
                    Preferred Vendors
                  </h3>
                  <div className="space-y-3">
                    {userAnalytics.preferredVendors.map((vendor, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-slate-700">{vendor.vendorName}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-gold-600 h-2 rounded-full"
                              style={{
                                width: `${(vendor.bookingCount / userAnalytics.preferredVendors[0].bookingCount) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-slate-900 w-8 text-right">
                            {vendor.bookingCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Carbon Footprint</h3>
                <div className="text-3xl font-bold text-green-700 mb-2">
                  {userAnalytics.carbonFootprint.toFixed(2)} tonnes CO₂
                </div>
                <p className="text-slate-600">
                  Consider purchasing carbon offsets to support sustainability initiatives
                </p>
              </div>
            </div>
          )}

          {/* Vendor Analytics */}
          {viewMode === 'vendor' && vendorAnalytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={Building2}
                  label="Total Deals"
                  value={vendorAnalytics.totalDeals}
                />
                <StatCard
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`$${vendorAnalytics.totalRevenue.toLocaleString()}`}
                />
                <StatCard
                  icon={Star}
                  label="Average Rating"
                  value={vendorAnalytics.averageRating.toFixed(1)}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Conversion Rate"
                  value={`${vendorAnalytics.conversionRate.toFixed(1)}%`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                  icon={Users}
                  label="Total Views"
                  value={vendorAnalytics.totalViews.toLocaleString()}
                  className="md:col-span-1"
                />
                <StatCard
                  icon={DollarSign}
                  label="Quote Requests"
                  value={vendorAnalytics.totalQuotes}
                  className="md:col-span-1"
                />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Performing Deals</h3>
                <div className="space-y-3">
                  {vendorAnalytics.topPerformingDeals.map((deal, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gold-100 text-gold-700 rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <span className="text-slate-700">{deal.title}</span>
                      </div>
                      <span className="text-lg font-semibold text-slate-900">
                        ${deal.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-gold-50 to-yellow-50 rounded-xl border border-gold-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Customer Satisfaction</h3>
                <div className="text-3xl font-bold text-gold-700 mb-2">
                  {vendorAnalytics.customerSatisfaction.toFixed(1)}%
                </div>
                <p className="text-slate-600">Based on customer reviews and ratings</p>
              </div>
            </div>
          )}

          {/* Platform Analytics (Admin Only) */}
          {viewMode === 'platform' && platformAnalytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={Users}
                  label="Total Users"
                  value={platformAnalytics.totalUsers.toLocaleString()}
                  trend={platformAnalytics.revenueGrowth}
                />
                <StatCard
                  icon={Building2}
                  label="Total Vendors"
                  value={platformAnalytics.totalVendors}
                />
                <StatCard
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`$${(platformAnalytics.totalRevenue / 1000000).toFixed(1)}M`}
                  trend={platformAnalytics.revenueGrowth}
                />
                <StatCard
                  icon={Plane}
                  label="Total Bookings"
                  value={platformAnalytics.totalBookings.toLocaleString()}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                  icon={Users}
                  label="Active Users"
                  value={platformAnalytics.activeUsers.toLocaleString()}
                  className="md:col-span-1"
                />
                <StatCard
                  icon={TrendingUp}
                  label="New Users This Month"
                  value={platformAnalytics.newUsersThisMonth}
                  className="md:col-span-1"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Destinations</h3>
                  <div className="space-y-3">
                    {platformAnalytics.topDestinations.map((dest, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-semibold text-sm">
                            {index + 1}
                          </div>
                          <span className="text-slate-700">{dest.destination}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          {dest.bookingCount} bookings
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Vendors by Revenue</h3>
                  <div className="space-y-3">
                    {platformAnalytics.topVendors.map((vendor, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gold-100 text-gold-700 rounded-full flex items-center justify-center font-semibold text-sm">
                            {index + 1}
                          </div>
                          <span className="text-slate-700">{vendor.vendorName}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          ${vendor.revenue.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
