import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  Calendar,
  MapPin,
  DollarSign,
  Plane,
  Hotel,
  Utensils,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

export default function ItineraryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchItinerary();
    }
  }, [id]);

  const fetchItinerary = async () => {
    try {
      const response: any = await api.itineraries.get(id!);
      setItinerary(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-luxury-600">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center py-12">
          <p className="text-red-600 mb-4">{error || 'Itinerary not found'}</p>
          <Link to="/itineraries" className="btn-primary">
            Back to Itineraries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        to="/itineraries"
        className="inline-flex items-center text-luxury-600 hover:text-luxury-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Itineraries
      </Link>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-4xl font-bold text-luxury-900">
              {itinerary.title}
            </h1>
            {itinerary.ai_generated && (
              <Sparkles className="h-6 w-6 text-gold-500" />
            )}
          </div>
          <span
            className={`px-3 py-1 text-sm font-semibold rounded-full ${
              itinerary.status === 'active'
                ? 'bg-green-100 text-green-800'
                : itinerary.status === 'draft'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-luxury-100 text-luxury-800'
            }`}
          >
            {itinerary.status}
          </span>
        </div>

        {itinerary.description && (
          <p className="text-lg text-luxury-600 mb-4">{itinerary.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center text-luxury-700">
            <Calendar className="h-5 w-5 mr-2" />
            {format(new Date(itinerary.start_date), 'MMMM d, yyyy')} -{' '}
            {format(new Date(itinerary.end_date), 'MMMM d, yyyy')}
          </div>
          {itinerary.total_budget && (
            <div className="flex items-center text-luxury-700">
              <DollarSign className="h-5 w-5 mr-2" />
              Budget: ${itinerary.total_budget.toLocaleString()}{' '}
              {itinerary.currency}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Destinations */}
          {itinerary.destinations && itinerary.destinations.length > 0 && (
            <div className="card">
              <h2 className="text-2xl font-semibold text-luxury-900 mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2 text-gold-500" />
                Destinations
              </h2>
              <div className="space-y-4">
                {itinerary.destinations.map((dest: any) => (
                  <div
                    key={dest.id}
                    className="border-l-4 border-gold-500 pl-4 py-2"
                  >
                    <h3 className="font-semibold text-luxury-900">
                      {dest.name}, {dest.country}
                    </h3>
                    <p className="text-sm text-luxury-600">
                      {format(new Date(dest.arrival_date), 'MMM d')} -{' '}
                      {format(new Date(dest.departure_date), 'MMM d, yyyy')}
                    </p>
                    {dest.notes && (
                      <p className="text-sm text-luxury-600 mt-1">{dest.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transportation */}
          {itinerary.transportation && itinerary.transportation.length > 0 && (
            <div className="card">
              <h2 className="text-2xl font-semibold text-luxury-900 mb-4 flex items-center">
                <Plane className="h-6 w-6 mr-2 text-gold-500" />
                Transportation
              </h2>
              <div className="space-y-3">
                {itinerary.transportation.map((transport: any) => (
                  <div key={transport.id} className="bg-luxury-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-luxury-900 capitalize">
                          {transport.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-luxury-600">
                          {format(
                            new Date(transport.departure_time),
                            'MMM d, h:mm a'
                          )}{' '}
                          -{' '}
                          {format(new Date(transport.arrival_time), 'MMM d, h:mm a')}
                        </p>
                        {transport.provider && (
                          <p className="text-sm text-luxury-600">
                            Provider: {transport.provider}
                          </p>
                        )}
                      </div>
                      {transport.cost && (
                        <span className="text-luxury-900 font-semibold">
                          ${transport.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accommodations */}
          {itinerary.accommodations && itinerary.accommodations.length > 0 && (
            <div className="card">
              <h2 className="text-2xl font-semibold text-luxury-900 mb-4 flex items-center">
                <Hotel className="h-6 w-6 mr-2 text-gold-500" />
                Accommodations
              </h2>
              <div className="space-y-3">
                {itinerary.accommodations.map((accommodation: any) => (
                  <div key={accommodation.id} className="bg-luxury-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-luxury-900">
                          {accommodation.name}
                        </p>
                        <p className="text-sm text-luxury-600 capitalize">
                          {accommodation.type}
                        </p>
                        <p className="text-sm text-luxury-600">
                          {format(new Date(accommodation.check_in), 'MMM d')} -{' '}
                          {format(new Date(accommodation.check_out), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-luxury-600">
                          {accommodation.rooms} room(s), {accommodation.guests}{' '}
                          guest(s)
                        </p>
                      </div>
                      {accommodation.cost && (
                        <span className="text-luxury-900 font-semibold">
                          ${accommodation.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {itinerary.activities && itinerary.activities.length > 0 && (
            <div className="card">
              <h2 className="text-2xl font-semibold text-luxury-900 mb-4 flex items-center">
                <Utensils className="h-6 w-6 mr-2 text-gold-500" />
                Activities & Experiences
              </h2>
              <div className="space-y-3">
                {itinerary.activities.map((activity: any) => (
                  <div key={activity.id} className="bg-luxury-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-luxury-900">
                          {activity.name}
                        </p>
                        {activity.description && (
                          <p className="text-sm text-luxury-600 mt-1">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-sm text-luxury-600 mt-1">
                          {format(new Date(activity.start_time), 'MMM d, h:mm a')} -{' '}
                          {format(new Date(activity.end_time), 'h:mm a')}
                        </p>
                        {activity.category && (
                          <span className="inline-block mt-2 px-2 py-1 bg-white text-xs rounded-full text-luxury-700">
                            {activity.category}
                          </span>
                        )}
                      </div>
                      {activity.cost && (
                        <span className="text-luxury-900 font-semibold ml-4">
                          ${activity.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-luxury-900 mb-4">
              Itinerary Summary
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-luxury-600">Status:</span>
                <span className="ml-2 font-semibold capitalize">
                  {itinerary.status}
                </span>
              </div>
              <div>
                <span className="text-luxury-600">Approval:</span>
                <span className="ml-2 font-semibold capitalize">
                  {itinerary.approval_status.replace('_', ' ')}
                </span>
              </div>
              {itinerary.total_budget && (
                <div>
                  <span className="text-luxury-600">Budget:</span>
                  <span className="ml-2 font-semibold">
                    ${itinerary.total_budget.toLocaleString()}
                  </span>
                </div>
              )}
              {itinerary.actual_cost && (
                <div>
                  <span className="text-luxury-600">Actual Cost:</span>
                  <span className="ml-2 font-semibold">
                    ${itinerary.actual_cost.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {itinerary.sustainability_metrics && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="font-semibold text-luxury-900 mb-4">
                Sustainability
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-luxury-600">Carbon Emissions:</span>
                  <span className="ml-2 font-semibold">
                    {itinerary.sustainability_metrics.totalCarbonEmissions} kg CO₂
                  </span>
                </div>
                <div>
                  <span className="text-luxury-600">Offset:</span>
                  <span className="ml-2 font-semibold">
                    {itinerary.sustainability_metrics.offsetAmount} kg CO₂
                  </span>
                </div>
                <div>
                  <span className="text-luxury-600">Score:</span>
                  <span className="ml-2 font-semibold">
                    {itinerary.sustainability_metrics.sustainabilityScore}/100
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
