import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Tag, Eye, ThumbsUp, MessageSquare, Send } from 'lucide-react';

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

interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  pseudonym?: string;
  content: string;
  isAnonymous: boolean;
  upvotes: number;
  createdAt: string;
}

export function ForumPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyForm, setReplyForm] = useState({
    content: '',
    isAnonymous: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [upvotedPost, setUpvotedPost] = useState(false);
  const [upvotedReplies, setUpvotedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      loadPost();
      loadReplies();
    }
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const response = await api.forum.getPost(id!);
      setPost(response.data);
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async () => {
    try {
      const response = await api.forum.getReplies(id!);
      setReplies(response.data || []);
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    try {
      setSubmitting(true);
      await api.forum.createReply(id, {
        authorId: user.id,
        content: replyForm.content,
        isAnonymous: replyForm.isAnonymous,
      });
      setReplyForm({ content: '', isAnonymous: false });
      loadPost();
      loadReplies();
    } catch (error) {
      console.error('Failed to create reply:', error);
      alert('Failed to create reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvotePost = async () => {
    if (!id || upvotedPost) return;

    try {
      await api.forum.upvotePost(id);
      setUpvotedPost(true);
      if (post) {
        setPost({ ...post, upvotes: post.upvotes + 1 });
      }
    } catch (error) {
      console.error('Failed to upvote post:', error);
    }
  };

  const handleUpvoteReply = async (replyId: string) => {
    if (upvotedReplies.has(replyId)) return;

    try {
      await api.forum.upvoteReply(replyId);
      setUpvotedReplies(new Set([...upvotedReplies, replyId]));
      setReplies(
        replies.map((r) => (r.id === replyId ? { ...r, upvotes: r.upvotes + 1 } : r))
      );
    } catch (error) {
      console.error('Failed to upvote reply:', error);
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Post not found</p>
        <button
          onClick={() => navigate('/forum')}
          className="mt-4 text-gold-600 hover:text-gold-700"
        >
          Return to Forum
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/forum')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Forum
      </button>

      {/* Post */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded">
            {post.category}
          </span>
          {post.isAnonymous && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded">
              Anonymous
            </span>
          )}
        </div>

        <h1 className="text-3xl font-display font-bold text-slate-900 mb-4">{post.title}</h1>

        <div className="flex items-center gap-6 text-sm text-slate-500 mb-6">
          <span className="font-medium text-slate-700">
            {post.isAnonymous ? post.pseudonym : post.authorName}
          </span>
          <span>{formatDate(post.createdAt)}</span>
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {post.viewCount} views
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            {post.replyCount} replies
          </div>
        </div>

        <div className="prose max-w-none mb-6">
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-gold-50 text-gold-700 text-sm rounded">
                <Tag className="h-4 w-4" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={handleUpvotePost}
            disabled={upvotedPost}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              upvotedPost
                ? 'bg-gold-100 text-gold-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ThumbsUp className={`h-4 w-4 ${upvotedPost ? 'fill-gold-700' : ''}`} />
            {post.upvotes}
          </button>
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold text-slate-900">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {replies.map((reply) => (
          <div key={reply.id} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <span className="font-medium text-slate-900">
                    {reply.isAnonymous ? reply.pseudonym : reply.authorName}
                  </span>
                  {reply.isAnonymous && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      Anonymous
                    </span>
                  )}
                  <span className="text-sm text-slate-500">{formatDate(reply.createdAt)}</span>
                </div>

                <p className="text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">{reply.content}</p>

                <button
                  onClick={() => handleUpvoteReply(reply.id)}
                  disabled={upvotedReplies.has(reply.id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                    upvotedReplies.has(reply.id)
                      ? 'bg-gold-100 text-gold-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ThumbsUp className={`h-3 w-3 ${upvotedReplies.has(reply.id) ? 'fill-gold-700' : ''}`} />
                  {reply.upvotes}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      {user && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add a Reply</h3>
          <form onSubmit={handleReplySubmit} className="space-y-4">
            <div>
              <textarea
                required
                value={replyForm.content}
                onChange={(e) => setReplyForm({ ...replyForm, content: e.target.value })}
                rows={4}
                placeholder="Share your thoughts..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
              ></textarea>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reply-anonymous"
                  checked={replyForm.isAnonymous}
                  onChange={(e) => setReplyForm({ ...replyForm, isAnonymous: e.target.checked })}
                  className="w-4 h-4 text-gold-600 border-slate-300 rounded focus:ring-gold-500"
                />
                <label htmlFor="reply-anonymous" className="text-sm text-slate-700">
                  Reply anonymously
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
