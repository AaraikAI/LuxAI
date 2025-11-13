import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ArrowLeft, Star, MapPin, Tag, Calendar, Users, Mail, Phone, MessageSquare } from 'lucide-react';

interface VaultDeal {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  title: string;
  description: string;
  location: string;
  exclusivityLevel: 'invitation_only' | 'limited_access' | 'exclusive';
  tags: string[];
  priceRange: string;
  rating: number;
  viewCount: number;
  isAvailable: boolean;
  imageUrl?: string;
  detailedDescription?: string;
  amenities?: string[];
  maxGuests?: number;
}

export function VaultDealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<VaultDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    name: '',
    email: '',
    phone: '',
    dates: '',
    guests: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  useEffect(() => {
    if (id) {
      loadDeal();
    }
  }, [id]);

  const loadDeal = async () => {
    try {
      setLoading(true);
      const response = await api.vault.getDeal(id!);
      setDeal(response.data);
    } catch (error) {
      console.error('Failed to load deal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setSubmitting(true);
      await api.vault.requestQuote(id, quoteForm);
      setQuoteSubmitted(true);
      setShowQuoteForm(false);
    } catch (error) {
      console.error('Failed to submit quote request:', error);
      alert('Failed to submit quote request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getExclusivityBadge = (level: string) => {
    const badges = {
      invitation_only: { text: 'Invitation Only', className: 'bg-purple-100 text-purple-800' },
      limited_access: { text: 'Limited Access', className: 'bg-gold-100 text-gold-800' },
      exclusive: { text: 'Exclusive', className: 'bg-blue-100 text-blue-800' },
    };
    return badges[level as keyof typeof badges] || badges.exclusive;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Deal not found</p>
        <button
          onClick={() => navigate('/vault')}
          className="mt-4 text-gold-600 hover:text-gold-700"
        >
          Return to Vault
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/vault')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Vault
      </button>

      {/* Hero Image */}
      <div className="h-96 bg-gradient-to-br from-gold-100 to-gold-200 rounded-xl flex items-center justify-center overflow-hidden">
        {deal.imageUrl ? (
          <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
        ) : (
          <Star className="h-24 w-24 text-gold-600" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded ${getExclusivityBadge(deal.exclusivityLevel).className}`}>
                {getExclusivityBadge(deal.exclusivityLevel).text}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded">{deal.category}</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-slate-900 mb-2">{deal.title}</h1>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="flex items-center gap-1">
                <MapPin className="h-5 w-5" />
                {deal.location}
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-gold-500 fill-gold-500" />
                <span className="font-medium">{deal.rating.toFixed(1)}</span>
              </div>
              <span>{deal.viewCount} views</span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3">About This Experience</h2>
            <p className="text-slate-700 leading-relaxed mb-4">{deal.description}</p>
            {deal.detailedDescription && (
              <p className="text-slate-700 leading-relaxed">{deal.detailedDescription}</p>
            )}
          </div>

          {/* Amenities */}
          {deal.amenities && deal.amenities.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-display font-bold text-slate-900 mb-3">Amenities & Features</h2>
              <div className="grid grid-cols-2 gap-3">
                {deal.amenities.map((amenity, index) => (
                  <div key={index} className="flex items-center gap-2 text-slate-700">
                    <div className="w-1.5 h-1.5 bg-gold-600 rounded-full"></div>
                    {amenity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {deal.tags.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-display font-bold text-slate-900 mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {deal.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded">
                    <Tag className="h-4 w-4" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quote Success Message */}
          {quoteSubmitted && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 mb-2">Quote Request Submitted</h3>
              <p className="text-green-800">
                Your quote request has been sent to {deal.vendorName}. They will contact you within 24 hours.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6 space-y-6">
            <div>
              <div className="text-2xl font-bold text-slate-900 mb-2">{deal.priceRange}</div>
              {deal.maxGuests && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="h-5 w-5" />
                  Up to {deal.maxGuests} guests
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-3">Vendor</h3>
              <p className="text-slate-700">{deal.vendorName}</p>
            </div>

            {deal.isAvailable ? (
              <button
                onClick={() => setShowQuoteForm(!showQuoteForm)}
                className="w-full px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium"
              >
                Request Quote
              </button>
            ) : (
              <div className="w-full px-6 py-3 bg-slate-100 text-slate-500 rounded-lg text-center">
                Currently Unavailable
              </div>
            )}

            {/* Quote Form */}
            {showQuoteForm && (
              <form onSubmit={handleQuoteSubmit} className="space-y-4 border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900">Request a Quote</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={quoteForm.name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={quoteForm.email}
                      onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={quoteForm.phone}
                      onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Dates</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g., Jan 15-20, 2025"
                      value={quoteForm.dates}
                      onChange={(e) => setQuoteForm({ ...quoteForm, dates: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Guests</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      value={quoteForm.guests}
                      onChange={(e) => setQuoteForm({ ...quoteForm, guests: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <textarea
                      value={quoteForm.message}
                      onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                      rows={4}
                      placeholder="Tell us about your requirements..."
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                    ></textarea>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
