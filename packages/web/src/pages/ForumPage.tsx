import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { MessageSquare, TrendingUp, Plus, Tag, Eye, ThumbsUp, Filter } from 'lucide-react';

interface ForumPost {
  id: string;
  authorId: string;
  authorName: string;
  pseudonym?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isAnonymous: boolean;
  replyCount: number;
  viewCount: number;
  upvotes: number;
  createdAt: string;
}

export function ForumPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'trending'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    tags: [] as string[],
  });
  const [createForm, setCreateForm] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: '',
    isAnonymous: false,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadPosts();
    loadTrendingPosts();
  }, [filters]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.category) params.category = filters.category;
      if (filters.tags.length > 0) params.tags = filters.tags;

      const response = await api.forum.getPosts(params);
      setPosts(response.data || []);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingPosts = async () => {
    try {
      const response = await api.forum.getTrendingPosts();
      setTrendingPosts(response.data || []);
    } catch (error) {
      console.error('Failed to load trending posts:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setCreating(true);
      await api.forum.createPost({
        authorId: user.id,
        title: createForm.title,
        content: createForm.content,
        category: createForm.category,
        tags: createForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        isAnonymous: createForm.isAnonymous,
      });
      setShowCreateForm(false);
      setCreateForm({
        title: '',
        content: '',
        category: 'general',
        tags: '',
        isAnonymous: false,
      });
      loadPosts();
      loadTrendingPosts();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const displayPosts = activeTab === 'trending' ? trendingPosts : posts;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Community Forum</h1>
          <p className="text-slate-600">Connect with fellow luxury travelers and share experiences</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium"
        >
          <Plus className="h-5 w-5" />
          New Post
        </button>
      </div>

      {/* Tabs and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-gold-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Posts
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'trending'
                ? 'bg-gold-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </button>
        </div>

        <div className="flex gap-3">
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
          >
            <option value="">All Categories</option>
            <option value="general">General Discussion</option>
            <option value="destinations">Destinations</option>
            <option value="hotels">Hotels & Resorts</option>
            <option value="aviation">Private Aviation</option>
            <option value="dining">Fine Dining</option>
            <option value="experiences">Experiences</option>
          </select>
        </div>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
          <p className="text-slate-600 mt-4">Loading posts...</p>
        </div>
      ) : displayPosts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No posts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/forum/posts/${post.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                      {post.category}
                    </span>
                    {post.isAnonymous && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        Anonymous
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-semibold text-slate-900 mb-2">{post.title}</h2>

                  <p className="text-slate-600 mb-3 line-clamp-2">{post.content}</p>

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-gold-50 text-gold-700 text-xs rounded">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">
                      {post.isAnonymous ? post.pseudonym : post.authorName}
                    </span>
                    <span>{formatDate(post.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {post.replyCount}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {post.viewCount}
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {post.upvotes}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">Create New Post</h2>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="What's on your mind?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                >
                  <option value="general">General Discussion</option>
                  <option value="destinations">Destinations</option>
                  <option value="hotels">Hotels & Resorts</option>
                  <option value="aviation">Private Aviation</option>
                  <option value="dining">Fine Dining</option>
                  <option value="experiences">Experiences</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  required
                  value={createForm.content}
                  onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                  rows={6}
                  placeholder="Share your thoughts, experiences, or questions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={createForm.tags}
                  onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                  placeholder="e.g., luxury, travel, maldives"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={createForm.isAnonymous}
                  onChange={(e) => setCreateForm({ ...createForm, isAnonymous: e.target.checked })}
                  className="w-4 h-4 text-gold-600 border-slate-300 rounded focus:ring-gold-500"
                />
                <label htmlFor="anonymous" className="text-sm text-slate-700">
                  Post anonymously (you'll be shown with a pseudonym)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
