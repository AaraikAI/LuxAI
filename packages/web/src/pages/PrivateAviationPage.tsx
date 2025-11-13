import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plane, Calendar, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function PrivateAviationPage() {
  const [activeTab, setActiveTab] = useState<'rfq' | 'empty-legs' | 'aircraft'>('empty-legs');
  const [emptyLegs, setEmptyLegs] = useState<any[]>([]);
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'empty-legs') {
      searchEmptyLegs();
    } else if (activeTab === 'aircraft') {
      fetchAircraft();
    }
  }, [activeTab]);

  const searchEmptyLegs = async () => {
    setLoading(true);
    try {
      const response: any = await api.aviation.searchEmptyLegs({});
      setEmptyLegs(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load empty legs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const response: any = await api.aviation.getAircraft();
      setAircraft(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-luxury-900 mb-2 flex items-center">
          <Plane className="h-10 w-10 mr-3 text-gold-500" />
          Private Aviation
        </h1>
        <p className="text-luxury-600">
          Book private jets with Amalfi Jets - Access 3,500+ aircraft worldwide
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-luxury-200 mb-8">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('empty-legs')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'empty-legs'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-luxury-600 hover:text-luxury-900'
            }`}
          >
            Empty Legs
            <span className="ml-2 text-xs bg-gold-100 text-gold-800 px-2 py-1 rounded-full">
              Save up to 75%
            </span>
          </button>
          <button
            onClick={() => setActiveTab('rfq')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'rfq'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-luxury-600 hover:text-luxury-900'
            }`}
          >
            Request Quote
          </button>
          <button
            onClick={() => setActiveTab('aircraft')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'aircraft'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-luxury-600 hover:text-luxury-900'
            }`}
          >
            Browse Aircraft
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Empty Legs Tab */}
      {activeTab === 'empty-legs' && (
        <div>
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-luxury-900 mb-4">
              Available Empty Legs
            </h2>
            <p className="text-sm text-luxury-600 mb-4">
              Empty leg flights offer significant savings (up to 75% off) when aircraft need to
              reposition. Limited availability and flexibility required.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-luxury-600">Loading available flights...</p>
            </div>
          ) : emptyLegs.length === 0 ? (
            <div className="card text-center py-12">
              <Plane className="h-16 w-16 text-luxury-300 mx-auto mb-4" />
              <p className="text-luxury-600">No empty legs available at this time</p>
              <p className="text-sm text-luxury-500 mt-2">Check back soon or request a custom quote</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {emptyLegs.map((leg) => (
                <EmptyLegCard key={leg.id} leg={leg} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* RFQ Tab */}
      {activeTab === 'rfq' && <RFQForm />}

      {/* Aircraft Tab */}
      {activeTab === 'aircraft' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-luxury-600">Loading aircraft...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {aircraft.map((plane) => (
                <AircraftCard key={plane.id} aircraft={plane} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyLegCard({ leg }: { leg: any }) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-luxury-900">
            {leg.origin.city} → {leg.destination.city}
          </h3>
          <p className="text-sm text-luxury-600">
            {leg.origin.code} to {leg.destination.code}
          </p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
          {leg.discount}% OFF
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm text-luxury-700">
          <Calendar className="h-4 w-4 mr-2 text-luxury-500" />
          {format(new Date(leg.departureDate), 'MMM d, yyyy')}
          {leg.flexibilityDays > 0 && (
            <span className="ml-2 text-luxury-500">
              (±{leg.flexibilityDays} day{leg.flexibilityDays > 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center text-sm text-luxury-700">
          <Plane className="h-4 w-4 mr-2 text-luxury-500" />
          {leg.aircraft.manufacturer} {leg.aircraft.model}
        </div>

        <div className="flex items-center text-sm text-luxury-700">
          <Users className="h-4 w-4 mr-2 text-luxury-500" />
          Up to {leg.aircraft.capacity} passengers
        </div>

        {leg.aircraft.safetyBadges && leg.aircraft.safetyBadges.length > 0 && (
          <div className="flex items-center text-sm text-luxury-700">
            <Shield className="h-4 w-4 mr-2 text-luxury-500" />
            {leg.aircraft.safetyBadges.join(', ')}
          </div>
        )}
      </div>

      <div className="border-t border-luxury-200 pt-4 mt-4 flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-luxury-900">
            ${leg.price.toLocaleString()}
          </p>
          <p className="text-xs text-luxury-500">Total price</p>
        </div>
        <button className="btn-primary">
          Request Booking
        </button>
      </div>
    </div>
  );
}

function AircraftCard({ aircraft }: { aircraft: any }) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-luxury-900">
          {aircraft.manufacturer} {aircraft.model}
        </h3>
        <p className="text-sm text-luxury-600 capitalize">{aircraft.category}</p>
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-luxury-600">Capacity:</span>
          <span className="font-semibold">{aircraft.capacity} passengers</span>
        </div>
        <div className="flex justify-between">
          <span className="text-luxury-600">Range:</span>
          <span className="font-semibold">{aircraft.range.toLocaleString()} nm</span>
        </div>
        <div className="flex justify-between">
          <span className="text-luxury-600">Speed:</span>
          <span className="font-semibold">{aircraft.speed} knots</span>
        </div>
        {aircraft.yearBuilt && (
          <div className="flex justify-between">
            <span className="text-luxury-600">Year:</span>
            <span className="font-semibold">{aircraft.yearBuilt}</span>
          </div>
        )}
      </div>

      {aircraft.safetyBadges && aircraft.safetyBadges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {aircraft.safetyBadges.map((badge: string) => (
            <span
              key={badge}
              className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {aircraft.amenities && aircraft.amenities.length > 0 && (
        <div className="border-t border-luxury-200 pt-3 mt-3">
          <p className="text-xs text-luxury-600 mb-2">Amenities:</p>
          <div className="flex flex-wrap gap-1">
            {aircraft.amenities.slice(0, 4).map((amenity: string) => (
              <span
                key={amenity}
                className="text-xs text-luxury-700 bg-luxury-100 px-2 py-1 rounded"
              >
                {amenity}
              </span>
            ))}
            {aircraft.amenities.length > 4 && (
              <span className="text-xs text-luxury-500 px-2 py-1">
                +{aircraft.amenities.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RFQForm() {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    passengers: 1,
    specialRequests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.aviation.submitRFQ({
        legs: [
          {
            origin: { code: formData.origin },
            destination: { code: formData.destination },
            departureTime: new Date(formData.departureDate).toISOString(),
            passengers: formData.passengers,
          },
        ],
        specialRequests: formData.specialRequests,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          origin: '',
          destination: '',
          departureDate: '',
          passengers: 1,
          specialRequests: '',
        });
      }, 3000);
    } catch (error) {
      console.error('Failed to submit RFQ', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="card">
        <h2 className="text-2xl font-semibold text-luxury-900 mb-6">
          Request a Custom Quote
        </h2>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            Quote request submitted! We'll respond within 2 business hours.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-luxury-700 mb-2">
                Departure Airport *
              </label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="input"
                placeholder="e.g., TEB, JFK"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-luxury-700 mb-2">
                Arrival Airport *
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="input"
                placeholder="e.g., MIA, PBI"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-luxury-700 mb-2">
                Departure Date *
              </label>
              <input
                type="datetime-local"
                value={formData.departureDate}
                onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-luxury-700 mb-2">
                Passengers *
              </label>
              <input
                type="number"
                value={formData.passengers}
                onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) })}
                className="input"
                min="1"
                max="19"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-luxury-700 mb-2">
              Special Requests
            </label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
              className="input"
              rows={4}
              placeholder="Any specific requirements? (e.g., pets, catering, aircraft preference)"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-gold w-full">
            {submitting ? 'Submitting...' : 'Submit Quote Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
