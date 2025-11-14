import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Database, Download, Trash2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface DataRequest {
  id: string;
  user_id: string;
  request_type: 'export' | 'deletion';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: any;
  user_email?: string;
  user_name?: string;
}

export default function DataRequestAdminPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'export' | 'deletion'>('all');
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [filter, typeFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const response: any = await api.gdpr.getAllDataRequests({ status: filter === 'all' ? undefined : filter, type: typeFilter === 'all' ? undefined : typeFilter });
      setRequests(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      setError('');
      setSuccess('');
      await api.gdpr.approveDataRequest(requestId, { notes: reviewNotes });
      setSuccess('Request approved successfully. Processing has begun.');
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      setError('');
      setSuccess('');
      if (!reviewNotes.trim()) {
        setError('Please provide a reason for rejection');
        return;
      }
      await api.gdpr.rejectDataRequest(requestId, { notes: reviewNotes });
      setSuccess('Request rejected successfully.');
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'export' ? (
      <Download className="h-5 w-5 text-blue-600" />
    ) : (
      <Trash2 className="h-5 w-5 text-red-600" />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto mb-4"></div>
          <p className="text-luxury-600">Loading data requests...</p>
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
            <Database className="h-6 w-6 text-gold-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-luxury-900">Data Request Management</h1>
            <p className="text-luxury-600">
              Review and process GDPR data export and deletion requests
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg font-semibold">
            {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
          </div>
        )}
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

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="status-filter" className="label">
              Status Filter
            </label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="type-filter" className="label">
              Request Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="input"
            >
              <option value="all">All Types</option>
              <option value="export">Data Export</option>
              <option value="deletion">Data Deletion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      {requests.length === 0 ? (
        <div className="card text-center py-12">
          <Database className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-luxury-900 mb-2">No Data Requests</h3>
          <p className="text-luxury-600">
            No data requests match the selected filters.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-luxury-900">
                          {request.user_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-luxury-600">
                          {request.user_email || request.user_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(request.request_type)}
                        <span className="text-sm font-medium text-luxury-900 capitalize">
                          {request.request_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-600">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === 'pending' ? (
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="btn-primary text-xs"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="btn-secondary text-xs"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-luxury-900">
                  {selectedRequest.request_type === 'export' ? 'Data Export' : 'Data Deletion'} Request
                </h2>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedRequest.status)}
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeClass(
                      selectedRequest.status
                    )}`}
                  >
                    {selectedRequest.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-luxury-700 mb-1">User Information</h3>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <p className="text-sm">
                    <strong>Name:</strong> {selectedRequest.user_name || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <strong>Email:</strong> {selectedRequest.user_email || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <strong>User ID:</strong> {selectedRequest.user_id}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-luxury-700 mb-1">Request Details</h3>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <p className="text-sm">
                    <strong>Created:</strong> {formatDate(selectedRequest.created_at)}
                  </p>
                  <p className="text-sm">
                    <strong>Updated:</strong> {formatDate(selectedRequest.updated_at)}
                  </p>
                  {selectedRequest.completed_at && (
                    <p className="text-sm">
                      <strong>Completed:</strong> {formatDate(selectedRequest.completed_at)}
                    </p>
                  )}
                </div>
              </div>

              {selectedRequest.metadata && (
                <div>
                  <h3 className="text-sm font-medium text-luxury-700 mb-1">Additional Information</h3>
                  <div className="bg-slate-50 p-3 rounded border border-slate-200">
                    {selectedRequest.request_type === 'deletion' && selectedRequest.metadata.reason && (
                      <p className="text-sm">
                        <strong>Reason:</strong> {selectedRequest.metadata.reason}
                      </p>
                    )}
                    {selectedRequest.metadata.notes && (
                      <p className="text-sm">
                        <strong>Review Notes:</strong> {selectedRequest.metadata.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div>
                  <h3 className="text-sm font-medium text-luxury-700 mb-1">Review Notes</h3>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="Enter review notes (required for rejection)..."
                  />
                </div>
              )}

              {selectedRequest.request_type === 'deletion' && selectedRequest.status === 'pending' && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <strong>Warning:</strong> Approving this deletion request will permanently anonymize the user's data. This action cannot be undone. Please review carefully before proceeding.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6">
              <div className="flex gap-3">
                {selectedRequest.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApproveRequest(selectedRequest.id)}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve Request
                    </button>
                    <button
                      onClick={() => handleRejectRequest(selectedRequest.id)}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Request
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setReviewNotes('');
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
