import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Sparkles, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function ItinerariesPage() {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    try {
      const response: any = await api.itineraries.list();
      setItineraries(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load itineraries');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-luxury-600">Loading your itineraries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-luxury-900 mb-2">
            Your Itineraries
          </h1>
          <p className="text-luxury-600">
            Manage and view your luxury travel plans
          </p>
        </div>
        <Link to="/itineraries/new" className="btn-gold">
          <Sparkles className="inline-block mr-2 h-5 w-5" />
          Generate New
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {itineraries.length === 0 ? (
        <div className="card text-center py-16">
          <Sparkles className="h-16 w-16 text-gold-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-luxury-900 mb-2">
            No Itineraries Yet
          </h2>
          <p className="text-luxury-600 mb-6">
            Start planning your first luxury adventure with AI
          </p>
          <Link to="/itineraries/new" className="btn-primary inline-block">
            Create Your First Itinerary
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {itineraries.map((itinerary: any) => (
            <ItineraryCard key={itinerary.id} itinerary={itinerary} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItineraryCard({ itinerary }: { itinerary: any }) {
  return (
    <Link
      to={`/itineraries/${itinerary.id}`}
      className="card hover:shadow-lg transition-shadow"
    >
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              itinerary.status === 'active'
                ? 'bg-green-100 text-green-800'
                : itinerary.status === 'draft'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-luxury-100 text-luxury-800'
            }`}
          >
            {itinerary.status}
          </span>
          {itinerary.ai_generated && (
            <Sparkles className="h-4 w-4 text-gold-500" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-luxury-900 mb-2">
          {itinerary.title}
        </h3>
        <p className="text-sm text-luxury-600 line-clamp-2">
          {itinerary.description}
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center text-luxury-600">
          <Calendar className="h-4 w-4 mr-2" />
          {format(new Date(itinerary.start_date), 'MMM d')} -{' '}
          {format(new Date(itinerary.end_date), 'MMM d, yyyy')}
        </div>
        {itinerary.total_budget && (
          <div className="flex items-center text-luxury-600">
            <DollarSign className="h-4 w-4 mr-2" />
            ${itinerary.total_budget.toLocaleString()} {itinerary.currency}
          </div>
        )}
      </div>
    </Link>
  );
}
