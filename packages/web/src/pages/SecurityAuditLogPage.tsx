import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Shield, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface SecurityAlert {
  id: string;
  action: string;
  changes: any;
  timestamp: string;
  severity?: string;
  alertType?: string;
}

export default function SecurityAuditLogPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchAlerts();
  }, [limit]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError('');
      const response: any = await api.security.getAlerts(limit);
      setAlerts(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch security alerts');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Shield className="h-5 w-5 text-luxury-600" />;
    }
  };

  const getSeverityBadgeClass = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto mb-4"></div>
          <p className="text-luxury-600">Loading security audit logs...</p>
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
            <Shield className="h-6 w-6 text-gold-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-luxury-900">Security Audit Log</h1>
            <p className="text-luxury-600">Monitor security events and suspicious activities</p>
          </div>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <label htmlFor="limit" className="text-sm font-medium text-luxury-700">
            Show:
          </label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="input max-w-xs"
          >
            <option value={25}>Last 25 events</option>
            <option value={50}>Last 50 events</option>
            <option value={100}>Last 100 events</option>
            <option value={250}>Last 250 events</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      {alerts.length === 0 ? (
        <div className="card text-center py-12">
          <Shield className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-luxury-900 mb-2">No Security Events</h3>
          <p className="text-luxury-600">
            Your account has no recorded security events yet. Security activities will appear here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {alerts.map((alert) => {
                  const metadata = alert.changes;
                  const severity = metadata?.severity || 'info';
                  const alertType = metadata?.alertType || alert.action;
                  const description = metadata?.description || 'Security event recorded';

                  return (
                    <tr key={alert.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(severity)}
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityBadgeClass(
                              severity
                            )}`}
                          >
                            {severity.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-luxury-900">
                          {formatAction(alertType)}
                        </div>
                        <div className="text-sm text-luxury-600">{alert.action}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-luxury-700 max-w-md">
                          {description}
                          {metadata?.ipAddress && (
                            <div className="text-xs text-luxury-500 mt-1">
                              IP: {metadata.ipAddress}
                            </div>
                          )}
                          {metadata?.userAgent && (
                            <div className="text-xs text-luxury-500 mt-1">
                              {metadata.userAgent}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-600">
                        {formatTimestamp(alert.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Tips */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Review Regularly</h4>
              <p className="text-sm text-blue-800">
                Check your security log regularly to identify suspicious activity early.
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Enable 2FA</h4>
              <p className="text-sm text-amber-800">
                Two-factor authentication adds an extra layer of protection to your account.
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900 mb-1">Use Strong Passwords</h4>
              <p className="text-sm text-green-800">
                Ensure your password is unique, long, and includes special characters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
