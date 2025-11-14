import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Download, Share2, FileText, FileJson, FileSpreadsheet, Link2, Calendar, Check } from 'lucide-react';

interface Itinerary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  totalCost: number;
}

export function ReportsPage() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [shareExpiry, setShareExpiry] = useState(7);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    loadItineraries();
  }, []);

  const loadItineraries = async () => {
    try {
      setLoading(true);
      const response = await api.itineraries.list();
      setItineraries(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedItinerary(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load itineraries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedItinerary) return;

    try {
      setExporting(true);
      const response = await api.reports.exportPDF(selectedItinerary);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itinerary-${selectedItinerary}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedItinerary) return;

    try {
      setExporting(true);
      const response = await api.reports.exportCSV(selectedItinerary);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itinerary-${selectedItinerary}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (!selectedItinerary) return;

    try {
      setExporting(true);
      const response = await api.reports.exportJSON(selectedItinerary);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itinerary-${selectedItinerary}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      alert('Failed to export JSON. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!selectedItinerary) return;

    try {
      setExporting(true);
      const response = await api.reports.generateShareLink(selectedItinerary, {
        expiresInDays: shareExpiry,
      });
      setShareLink(response.data.shareLink);
      setShowShareModal(true);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      alert('Failed to generate share link. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { text: 'Draft', className: 'bg-slate-100 text-slate-700' },
      pending_approval: { text: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
      approved: { text: 'Approved', className: 'bg-green-100 text-green-700' },
      booked: { text: 'Booked', className: 'bg-blue-100 text-blue-700' },
      completed: { text: 'Completed', className: 'bg-purple-100 text-purple-700' },
      cancelled: { text: 'Cancelled', className: 'bg-red-100 text-red-700' },
    };
    return badges[status as keyof typeof badges] || badges.draft;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Reports & Exports</h1>
        <p className="text-slate-600">Export and share your itineraries in various formats</p>
      </div>

      {itineraries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No itineraries found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Itinerary Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Itinerary</h2>
              <div className="space-y-3">
                {itineraries.map((itinerary) => (
                  <div
                    key={itinerary.id}
                    onClick={() => setSelectedItinerary(itinerary.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedItinerary === itinerary.id
                        ? 'border-gold-600 bg-gold-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{itinerary.title}</h3>
                      {selectedItinerary === itinerary.id && (
                        <Check className="h-5 w-5 text-gold-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                      <Calendar className="h-3 w-3" />
                      {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(itinerary.status).className}`}>
                        {getStatusBadge(itinerary.status).text}
                      </span>
                      <span className="text-xs font-medium text-slate-700">
                        ${itinerary.totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Export Formats */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-display font-bold text-slate-900 mb-4">Export Formats</h2>
              <p className="text-slate-600 mb-6">
                Download your itinerary in various formats for offline access or integration with other tools.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleExportPDF}
                  disabled={!selectedItinerary || exporting}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-gold-600 hover:bg-gold-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-3 bg-red-100 rounded-lg">
                    <FileText className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900 mb-1">PDF</div>
                    <div className="text-xs text-slate-600">Printable document</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gold-600">
                    <Download className="h-4 w-4" />
                    Export
                  </div>
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={!selectedItinerary || exporting}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-gold-600 hover:bg-gold-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-3 bg-green-100 rounded-lg">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900 mb-1">CSV</div>
                    <div className="text-xs text-slate-600">Spreadsheet data</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gold-600">
                    <Download className="h-4 w-4" />
                    Export
                  </div>
                </button>

                <button
                  onClick={handleExportJSON}
                  disabled={!selectedItinerary || exporting}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-gold-600 hover:bg-gold-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileJson className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900 mb-1">JSON</div>
                    <div className="text-xs text-slate-600">Structured data</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gold-600">
                    <Download className="h-4 w-4" />
                    Export
                  </div>
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-display font-bold text-slate-900 mb-4">Share Itinerary</h2>
              <p className="text-slate-600 mb-6">
                Generate a secure, time-limited link to share your itinerary with others without requiring them to log in.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Link expiration (days)
                  </label>
                  <select
                    value={shareExpiry}
                    onChange={(e) => setShareExpiry(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500"
                  >
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateShareLink}
                  disabled={!selectedItinerary || exporting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Share2 className="h-5 w-5" />
                  Generate Share Link
                </button>
              </div>
            </div>

            {/* Export Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-2">Export Information</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>PDF exports include full itinerary details with formatting optimized for printing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>CSV exports are compatible with Excel, Google Sheets, and other spreadsheet applications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>JSON exports provide structured data for integration with external systems</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Share links expire automatically after the selected duration for security</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Share Link Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Link2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-display font-bold text-slate-900">Share Link Generated</h2>
            </div>

            <p className="text-slate-600 mb-4">
              Your itinerary can be accessed via this link. It will expire in {shareExpiry} day{shareExpiry > 1 ? 's' : ''}.
            </p>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 break-all">
              <code className="text-sm text-slate-800">{shareLink}</code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={handleCopyLink}
                className="flex-1 px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 font-medium"
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
