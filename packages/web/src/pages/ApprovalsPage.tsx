import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, Clock, DollarSign, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

export default function ApprovalsPage() {
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const response: any = await api.approvals.getPending();
      setPendingApprovals(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (approvalId: string, decision: 'approve' | 'reject', notes?: string) => {
    setProcessing(approvalId);
    try {
      await api.approvals.processDecision(approvalId, { decision, notes });
      // Remove from pending list
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    } catch (err: any) {
      setError(err.message || 'Failed to process approval');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-luxury-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-luxury-900 mb-2">
          Pending Approvals
        </h1>
        <p className="text-luxury-600">
          Review and approve itineraries awaiting your authorization
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {pendingApprovals.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-luxury-900 mb-2">
            All Caught Up!
          </h2>
          <p className="text-luxury-600">
            You have no pending approvals at this time
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={handleDecision}
              processing={processing === approval.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  onDecision,
  processing,
}: {
  approval: any;
  onDecision: (approvalId: string, decision: 'approve' | 'reject', notes?: string) => void;
  processing: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const budgetExceeded = approval.budget_cap && approval.total_budget > approval.budget_cap;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-luxury-900 mb-1">
            {approval.itinerary_title}
          </h3>
          <div className="flex items-center text-sm text-luxury-600 space-x-4">
            <span className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              {approval.client_first_name} {approval.client_last_name}
            </span>
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {format(new Date(approval.start_date), 'MMM d')} - {format(new Date(approval.end_date), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-gold-500" />
          <span className="text-sm text-luxury-600">
            Pending since {format(new Date(approval.created_at), 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-luxury-50 rounded-lg p-4">
          <p className="text-sm text-luxury-600 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-luxury-900 flex items-center">
            <DollarSign className="h-5 w-5" />
            {approval.total_budget?.toLocaleString() || 'TBD'}
          </p>
        </div>

        {approval.budget_cap && (
          <div className={`rounded-lg p-4 ${budgetExceeded ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-sm text-luxury-600 mb-1">Budget Cap</p>
            <p className={`text-2xl font-bold flex items-center ${budgetExceeded ? 'text-red-700' : 'text-green-700'}`}>
              <DollarSign className="h-5 w-5" />
              {approval.budget_cap.toLocaleString()}
            </p>
            {budgetExceeded && (
              <p className="text-xs text-red-600 mt-1">
                Exceeds cap by ${(approval.total_budget - approval.budget_cap).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <div className="bg-luxury-50 rounded-lg p-4">
          <p className="text-sm text-luxury-600 mb-1">Status</p>
          <p className="text-lg font-semibold text-luxury-900 capitalize">
            {approval.status.replace('_', ' ')}
          </p>
        </div>
      </div>

      {approval.notes && (
        <div className="bg-luxury-50 border-l-4 border-gold-500 p-4 mb-6">
          <p className="text-sm font-semibold text-luxury-900 mb-1">Notes:</p>
          <p className="text-sm text-luxury-700">{approval.notes}</p>
        </div>
      )}

      {budgetExceeded && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Budget Alert</p>
          <p className="text-sm text-red-700">
            This itinerary exceeds the budget cap by{' '}
            {Math.round(((approval.total_budget - approval.budget_cap) / approval.budget_cap) * 100)}%.
            Please review carefully before approving.
          </p>
        </div>
      )}

      <div className="border-t border-luxury-200 pt-6">
        {!showNotes ? (
          <div className="flex space-x-3">
            <button
              onClick={() => onDecision(approval.id, 'approve')}
              disabled={processing}
              className="flex-1 btn-primary flex items-center justify-center"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {processing ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={() => setShowNotes(true)}
              disabled={processing}
              className="flex-1 bg-red-600 text-white btn hover:bg-red-700 flex items-center justify-center"
            >
              <XCircle className="h-5 w-5 mr-2" />
              Reject
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="Please provide a reason for rejection..."
              required
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  onDecision(approval.id, 'reject', notes);
                  setShowNotes(false);
                  setNotes('');
                }}
                disabled={processing || !notes.trim()}
                className="flex-1 bg-red-600 text-white btn hover:bg-red-700"
              >
                {processing ? 'Processing...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => {
                  setShowNotes(false);
                  setNotes('');
                }}
                disabled={processing}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
