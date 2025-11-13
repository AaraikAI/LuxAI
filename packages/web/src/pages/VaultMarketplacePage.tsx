import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Search, Filter, Star, MapPin, Tag, ChevronRight } from 'lucide-react';

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
}

export function VaultMarketplacePage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<VaultDeal[]>([]);
  const [featured, setFeatured] = useState<VaultDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    exclusivityLevel: '',
    tags: [] as string[],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFeaturedDeals();
    loadDeals();
  }, []);

  const loadFeaturedDeals = async () => {
    try {
      const response = await api.vault.getFeatured();
      setFeatured(response.data || []);
    } catch (error) {
      console.error('Failed to load featured deals:', error);
    }
  };

  const loadDeals = async () => {
    try {
      setLoading(true);
      const searchFilters: any = {};

      if (filters.category) searchFilters.category = filters.category;
      if (filters.location) searchFilters.location = filters.location;
      if (filters.minPrice) searchFilters.minPrice = parseFloat(filters.minPrice);
      if (filters.maxPrice) searchFilters.maxPrice = parseFloat(filters.maxPrice);
      if (filters.exclusivityLevel) searchFilters.exclusivityLevel = filters.exclusivityLevel;
      if (filters.tags.length > 0) searchFilters.tags = filters.tags;
      if (searchTerm) searchFilters.searchTerm = searchTerm;

      const response = await api.vault.search(searchFilters);
      setDeals(response.data || []);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadDeals();
  };

  const getExclusivityBadge = (level: string) => {
    const badges = {
      invitation_only: { text: 'Invitation Only', className: 'bg-purple-100 text-purple-800' },
      limited_access: { text: 'Limited Access', className: 'bg-gold-100 text-gold-800' },
      exclusive: { text: 'Exclusive', className: 'bg-blue-100 text-blue-800' },
    };
    return badges[level as keyof typeof badges] || badges.exclusive;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">The Vault</h1>
        <p className="text-slate-600">Discover off-market luxury experiences curated exclusively for our members</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search exclusive experiences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Filter className="h-5 w-5" />
            Filters
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700"
          >
            Search
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              >
                <option value="">All Categories</option>
                <option value="accommodation">Accommodation</option>
                <option value="dining">Dining</option>
                <option value="experiences">Experiences</option>
                <option value="yacht">Yacht Charter</option>
                <option value="villa">Private Villa</option>
                <option value="event">Exclusive Events</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                placeholder="City, Country"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Exclusivity</label>
              <select
                value={filters.exclusivityLevel}
                onChange={(e) => setFilters({ ...filters, exclusivityLevel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              >
                <option value="">All Levels</option>
                <option value="invitation_only">Invitation Only</option>
                <option value="limited_access">Limited Access</option>
                <option value="exclusive">Exclusive</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Featured Deals */}
      {featured.length > 0 && (
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-4">Featured Experiences</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map((deal) => (
              <div
                key={deal.id}
                onClick={() => navigate(`/vault/deals/${deal.id}`)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="h-48 bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center">
                  {deal.imageUrl ? (
                    <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                  ) : (
                    <Star className="h-12 w-12 text-gold-600" />
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getExclusivityBadge(deal.exclusivityLevel).className}`}>
                        {getExclusivityBadge(deal.exclusivityLevel).text}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-gold-500 fill-gold-500" />
                      <span className="text-sm font-medium">{deal.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg text-slate-900 mb-1">{deal.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                    <MapPin className="h-4 w-4" />
                    {deal.location}
                  </div>
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">{deal.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {deal.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{deal.priceRange}</span>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Deals */}
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4">All Experiences</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
            <p className="text-slate-600 mt-4">Loading exclusive experiences...</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-600">No experiences found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => navigate(`/vault/deals/${deal.id}`)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  {deal.imageUrl ? (
                    <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                  ) : (
                    <Star className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getExclusivityBadge(deal.exclusivityLevel).className}`}>
                      {getExclusivityBadge(deal.exclusivityLevel).text}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-gold-500 fill-gold-500" />
                      <span className="text-sm font-medium">{deal.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{deal.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                    <MapPin className="h-4 w-4" />
                    {deal.location}
                  </div>
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">{deal.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{deal.priceRange}</span>
                    <span className="text-xs text-slate-500">{deal.viewCount} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
