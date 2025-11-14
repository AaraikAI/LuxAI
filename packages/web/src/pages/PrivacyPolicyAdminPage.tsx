import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { FileText, Plus, Save, Calendar, CheckCircle, Eye } from 'lucide-react';

interface PrivacyPolicy {
  id: string;
  version: string;
  content: string;
  effective_date: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
}

export default function PrivacyPolicyAdminPage() {
  const [policies, setPolicies] = useState<PrivacyPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PrivacyPolicy | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    version: '',
    content: '',
    effective_date: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError('');
      const response: any = await api.gdpr.getAllPrivacyPolicies();
      setPolicies(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch privacy policies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      await api.gdpr.createPrivacyPolicy(formData);
      setSuccess('Privacy policy created successfully!');
      setShowCreateForm(false);
      setFormData({ version: '', content: '', effective_date: '' });
      fetchPolicies();
    } catch (err: any) {
      setError(err.message || 'Failed to create privacy policy');
    }
  };

  const handleActivatePolicy = async (policyId: string) => {
    try {
      setError('');
      setSuccess('');
      await api.gdpr.activatePrivacyPolicy(policyId);
      setSuccess('Privacy policy activated successfully!');
      fetchPolicies();
    } catch (err: any) {
      setError(err.message || 'Failed to activate privacy policy');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading && policies.length === 0) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto mb-4"></div>
          <p className="text-luxury-600">Loading privacy policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gold-100 rounded-lg">
            <FileText className="h-6 w-6 text-gold-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-luxury-900">Privacy Policy Management</h1>
            <p className="text-luxury-600">Create and manage privacy policy versions</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Policy Version
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-luxury-900 mb-4">Create New Privacy Policy Version</h2>
          <form onSubmit={handleCreatePolicy} className="space-y-4">
            <div>
              <label htmlFor="version" className="label">
                Version Number *
              </label>
              <input
                type="text"
                id="version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="input"
                placeholder="e.g., 2.0"
                required
              />
            </div>

            <div>
              <label htmlFor="effective_date" className="label">
                Effective Date *
              </label>
              <input
                type="date"
                id="effective_date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="content" className="label">
                Policy Content (Markdown Supported) *
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="input min-h-[300px] font-mono text-sm"
                placeholder="# Privacy Policy&#10;&#10;## Introduction&#10;We collect and process your personal data..."
                required
              />
              <p className="text-sm text-luxury-500 mt-1">
                Use Markdown formatting for headings, lists, and emphasis
              </p>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Save className="h-4 w-4" />
                Create Policy
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Policies List */}
      <div className="space-y-4">
        {policies.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-luxury-900 mb-2">No Privacy Policies</h3>
            <p className="text-luxury-600 mb-4">
              Create your first privacy policy version to get started.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create First Policy
            </button>
          </div>
        ) : (
          policies.map((policy) => (
            <div
              key={policy.id}
              className={`card ${policy.is_active ? 'border-2 border-green-500' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-luxury-900">
                      Version {policy.version}
                    </h3>
                    {policy.is_active && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded border border-green-200 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-luxury-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Effective: {formatDate(policy.effective_date)}
                    </div>
                    <div>Created: {formatDate(policy.created_at)}</div>
                  </div>

                  <div className="prose prose-sm max-w-none">
                    <div className="bg-slate-50 p-4 rounded border border-slate-200 max-h-[200px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {policy.content.substring(0, 500)}
                        {policy.content.length > 500 && '...'}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Eye className="h-4 w-4" />
                    View Full
                  </button>
                  {!policy.is_active && (
                    <button
                      onClick={() => handleActivatePolicy(policy.id)}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View Policy Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-luxury-900">
                Privacy Policy Version {selectedPolicy.version}
              </h2>
              <p className="text-luxury-600">
                Effective: {formatDate(selectedPolicy.effective_date)}
              </p>
            </div>
            <div className="p-6">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{selectedPolicy.content}</pre>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6">
              <button
                onClick={() => setSelectedPolicy(null)}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
