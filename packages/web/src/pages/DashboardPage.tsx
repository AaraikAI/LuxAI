import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';
import { Sparkles, Map, CheckCircle, Clock } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-luxury-900 mb-2">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-luxury-600">
          Your personalized luxury travel command center
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard
          icon={<Map className="h-8 w-8 text-gold-500" />}
          label="Active Trips"
          value="0"
        />
        <StatCard
          icon={<Clock className="h-8 w-8 text-luxury-500" />}
          label="Pending Approvals"
          value="0"
        />
        <StatCard
          icon={<CheckCircle className="h-8 w-8 text-green-500" />}
          label="Completed Trips"
          value="0"
        />
        <StatCard
          icon={<Sparkles className="h-8 w-8 text-gold-500" />}
          label="AI Suggestions"
          value="0"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-2xl font-semibold text-luxury-900 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-4">
            <Link
              to="/itineraries/new"
              className="flex items-center justify-between p-4 bg-luxury-50 rounded-lg hover:bg-luxury-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Sparkles className="h-6 w-6 text-gold-500" />
                <div>
                  <h3 className="font-semibold text-luxury-900">
                    Generate New Itinerary
                  </h3>
                  <p className="text-sm text-luxury-600">
                    AI-powered trip planning in seconds
                  </p>
                </div>
              </div>
              <span className="text-luxury-400">→</span>
            </Link>

            <Link
              to="/itineraries"
              className="flex items-center justify-between p-4 bg-luxury-50 rounded-lg hover:bg-luxury-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Map className="h-6 w-6 text-luxury-700" />
                <div>
                  <h3 className="font-semibold text-luxury-900">
                    View All Itineraries
                  </h3>
                  <p className="text-sm text-luxury-600">
                    Manage your travel plans
                  </p>
                </div>
              </div>
              <span className="text-luxury-400">→</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-semibold text-luxury-900 mb-6">
            Recent Activity
          </h2>
          <div className="text-center py-12 text-luxury-500">
            <p>No recent activity</p>
            <Link
              to="/itineraries/new"
              className="inline-block mt-4 text-gold-600 hover:text-gold-700 font-medium"
            >
              Start planning your first trip
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center space-x-4">
        {icon}
        <div>
          <p className="text-sm text-luxury-600">{label}</p>
          <p className="text-3xl font-bold text-luxury-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
