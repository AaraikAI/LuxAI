import { useState } from 'react';
import { api } from '@/lib/api';
import { Plane, Calendar, Users, MapPin, ArrowRight, Clock, DollarSign } from 'lucide-react';

interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
  availableSeats: number;
}

export function FlightSearchPage() {
  const [searchForm, setSearchForm] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    passengers: 1,
    cabinClass: 'economy',
  });
  const [searchResults, setSearchResults] = useState<FlightOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    passportNumber: '',
  });
  const [booking, setBooking] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSearching(true);
      setSearchResults([]);
      const response = await api.gds.searchFlights({
        origin: searchForm.origin,
        destination: searchForm.destination,
        departureDate: searchForm.departureDate,
        returnDate: searchForm.returnDate || undefined,
        passengers: searchForm.passengers,
        cabinClass: searchForm.cabinClass,
      });
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Failed to search flights:', error);
      alert('Failed to search flights. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleBookFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlight) return;

    try {
      setBooking(true);
      const response = await api.gds.bookFlight(selectedFlight.id, {
        passengerDetails: {
          firstName: bookingForm.firstName,
          lastName: bookingForm.lastName,
          email: bookingForm.email,
          phone: bookingForm.phone,
          passportNumber: bookingForm.passportNumber,
        },
      });
      alert(`Booking confirmed! Confirmation number: ${response.data.confirmationNumber}`);
      setShowBookingForm(false);
      setSelectedFlight(null);
      setBookingForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        passportNumber: '',
      });
    } catch (error) {
      console.error('Failed to book flight:', error);
      alert('Failed to book flight. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Flight Search</h1>
        <p className="text-slate-600">Search and book commercial flights worldwide via Sabre GDS</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Origin</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                placeholder="JFK"
                value={searchForm.origin}
                onChange={(e) => setSearchForm({ ...searchForm, origin: e.target.value.toUpperCase() })}
                maxLength={3}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                placeholder="LHR"
                value={searchForm.destination}
                onChange={(e) => setSearchForm({ ...searchForm, destination: e.target.value.toUpperCase() })}
                maxLength={3}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Departure Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="date"
                required
                value={searchForm.departureDate}
                onChange={(e) => setSearchForm({ ...searchForm, departureDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Return Date (Optional)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="date"
                value={searchForm.returnDate}
                onChange={(e) => setSearchForm({ ...searchForm, returnDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passengers</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="number"
                required
                min="1"
                max="9"
                value={searchForm.passengers}
                onChange={(e) => setSearchForm({ ...searchForm, passengers: parseInt(e.target.value) })}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cabin Class</label>
            <select
              value={searchForm.cabinClass}
              onChange={(e) => setSearchForm({ ...searchForm, cabinClass: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={searching}
          className="w-full px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search Flights'}
        </button>
      </form>

      {/* Search Results */}
      {searching && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
          <p className="text-slate-600 mt-4">Searching flights...</p>
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-slate-900">Available Flights</h2>
          {searchResults.map((flight) => (
            <div key={flight.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-slate-400" />
                      <span className="font-semibold text-slate-900">{flight.airline}</span>
                      <span className="text-slate-600">{flight.flightNumber}</span>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-sm rounded capitalize">
                      {flight.cabinClass.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-slate-900">{formatTime(flight.departureTime)}</div>
                      <div className="text-slate-600">{flight.departureAirport}</div>
                      <div className="text-sm text-slate-500">{formatDate(flight.departureTime)}</div>
                    </div>

                    <div className="flex-1 text-center">
                      <div className="flex items-center gap-2 justify-center mb-1">
                        <div className="h-px bg-slate-300 flex-1"></div>
                        <Clock className="h-4 w-4 text-slate-400" />
                        <div className="h-px bg-slate-300 flex-1"></div>
                      </div>
                      <div className="text-sm text-slate-600">{formatDuration(flight.duration)}</div>
                      <div className="text-xs text-slate-500">
                        {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                      </div>
                    </div>

                    <div className="flex-1 text-right">
                      <div className="text-2xl font-bold text-slate-900">{formatTime(flight.arrivalTime)}</div>
                      <div className="text-slate-600">{flight.arrivalAirport}</div>
                      <div className="text-sm text-slate-500">{formatDate(flight.arrivalTime)}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-500">
                    {flight.availableSeats} seats available
                  </div>
                </div>

                <div className="ml-8 flex flex-col items-end gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-2xl font-bold text-slate-900">
                      <DollarSign className="h-6 w-6" />
                      {flight.price.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600">{flight.currency}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFlight(flight);
                      setShowBookingForm(true);
                    }}
                    className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {showBookingForm && selectedFlight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-4">Book Flight</h2>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600">{selectedFlight.departureAirport}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600">{selectedFlight.arrivalAirport}</span>
              </div>
              <div className="text-sm text-slate-600">{selectedFlight.airline} {selectedFlight.flightNumber}</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                ${selectedFlight.price.toLocaleString()}
              </div>
            </div>

            <form onSubmit={handleBookFlight} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={bookingForm.firstName}
                    onChange={(e) => setBookingForm({ ...bookingForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={bookingForm.lastName}
                    onChange={(e) => setBookingForm({ ...bookingForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={bookingForm.email}
                  onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={bookingForm.phone}
                  onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Passport Number</label>
                <input
                  type="text"
                  required
                  value={bookingForm.passportNumber}
                  onChange={(e) => setBookingForm({ ...bookingForm, passportNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedFlight(null);
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={booking}
                  className="flex-1 px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50"
                >
                  {booking ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
