import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Sparkles, Loader2 } from 'lucide-react';

export default function CreateItineraryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    destinations: '',
    budget: '',
    specialRequests: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const requestData = {
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        destinations: formData.destinations
          ? formData.destinations.split(',').map((d) => d.trim())
          : undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        specialRequests: formData.specialRequests || undefined,
      };

      const response: any = await api.itineraries.generate(requestData);
      navigate(`/itineraries/${response.data.itinerary.id}`);
    } catch (err: any) {
      setError(
        err.message || 'Failed to generate itinerary. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-luxury-900 mb-2">
          Generate Your Luxury Itinerary
        </h1>
        <p className="text-luxury-600">
          Let AI craft the perfect ultra-bespoke experience for you
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-luxury-700 mb-2"
              >
                Start Date *
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="input"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-luxury-700 mb-2"
              >
                End Date *
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="input"
                required
                min={formData.startDate || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="destinations"
              className="block text-sm font-medium text-luxury-700 mb-2"
            >
              Destinations (comma-separated)
            </label>
            <input
              type="text"
              id="destinations"
              name="destinations"
              value={formData.destinations}
              onChange={handleChange}
              className="input"
              placeholder="e.g., Paris, French Riviera, Monaco"
            />
            <p className="mt-1 text-sm text-luxury-500">
              Leave blank to let AI suggest destinations
            </p>
          </div>

          <div>
            <label
              htmlFor="budget"
              className="block text-sm font-medium text-luxury-700 mb-2"
            >
              Total Budget (USD)
            </label>
            <input
              type="number"
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              className="input"
              placeholder="e.g., 100000"
              min="0"
              step="1000"
            />
            <p className="mt-1 text-sm text-luxury-500">
              Optional - leave blank for ultra-luxury recommendations
            </p>
          </div>

          <div>
            <label
              htmlFor="specialRequests"
              className="block text-sm font-medium text-luxury-700 mb-2"
            >
              Special Requests & Preferences
            </label>
            <textarea
              id="specialRequests"
              name="specialRequests"
              value={formData.specialRequests}
              onChange={handleChange}
              className="input"
              rows={4}
              placeholder="Tell us about dietary restrictions, activity preferences, cultural interests, sustainability focus, or any special requirements..."
            />
          </div>

          <div className="bg-luxury-50 border border-luxury-200 rounded-lg p-4">
            <h3 className="font-semibold text-luxury-900 mb-2">
              What to Expect
            </h3>
            <ul className="text-sm text-luxury-600 space-y-1">
              <li>✓ AI-generated itinerary in under 60 seconds</li>
              <li>✓ Exclusive off-market experiences and accommodations</li>
              <li>✓ Private aviation and luxury transportation options</li>
              <li>✓ Michelin-starred dining recommendations</li>
              <li>✓ Cultural sensitivity and sustainability considerations</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full text-lg py-3"
          >
            {loading ? (
              <>
                <Loader2 className="inline-block mr-2 h-5 w-5 animate-spin" />
                Generating your luxury experience...
              </>
            ) : (
              <>
                <Sparkles className="inline-block mr-2 h-5 w-5" />
                Generate Itinerary
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
