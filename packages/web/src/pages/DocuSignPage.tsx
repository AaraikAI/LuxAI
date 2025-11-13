import React, { useState } from 'react';
import { api } from '@/lib/api';

interface Signer {
  name: string;
  email: string;
  recipientId: string;
  routingOrder: number;
}

interface EnvelopeStatus {
  envelopeId: string;
  status: string;
  signers: Array<{
    name: string;
    email: string;
    status: string;
    signedAt?: string;
  }>;
  createdAt: string;
  completedAt?: string;
}

export const DocuSignPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'track'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envelopeId, setEnvelopeId] = useState('');
  const [envelopeStatus, setEnvelopeStatus] = useState<EnvelopeStatus | null>(null);

  const [formData, setFormData] = useState({
    documentId: '',
    emailSubject: '',
    emailBody: '',
    signers: [
      { name: '', email: '', recipientId: '1', routingOrder: 1 },
    ] as Signer[],
  });

  const addSigner = () => {
    setFormData({
      ...formData,
      signers: [
        ...formData.signers,
        {
          name: '',
          email: '',
          recipientId: (formData.signers.length + 1).toString(),
          routingOrder: formData.signers.length + 1,
        },
      ],
    });
  };

  const removeSigner = (index: number) => {
    const newSigners = formData.signers.filter((_, i) => i !== index);
    setFormData({ ...formData, signers: newSigners });
  };

  const updateSigner = (index: number, field: keyof Signer, value: string | number) => {
    const newSigners = [...formData.signers];
    newSigners[index] = { ...newSigners[index], [field]: value };
    setFormData({ ...formData, signers: newSigners });
  };

  const handleCreateEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.docusign.createEnvelope(formData);
      alert(`Envelope created successfully! Envelope ID: ${response.data.envelopeId}`);

      // Reset form
      setFormData({
        documentId: '',
        emailSubject: '',
        emailBody: '',
        signers: [{ name: '', email: '', recipientId: '1', routingOrder: 1 }],
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to create envelope');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.docusign.getStatus(envelopeId);
      setEnvelopeStatus(response.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to get envelope status');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await api.docusign.download(id);
      // Create a blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed-document-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download document');
    }
  };

  const handleVoidEnvelope = async (id: string) => {
    const reason = prompt('Please provide a reason for voiding this envelope:');
    if (!reason) return;

    try {
      await api.docusign.voidEnvelope(id, reason);
      alert('Envelope voided successfully');
      setEnvelopeStatus(null);
    } catch (err: any) {
      alert('Failed to void envelope');
    }
  };

  const renderCreateTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Create E-Signature Envelope</h2>

      <form onSubmit={handleCreateEnvelope} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Document ID</label>
          <input
            type="text"
            value={formData.documentId}
            onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="UUID of the document to sign"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Enter the document ID from your uploaded files</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email Subject</label>
          <input
            type="text"
            value={formData.emailSubject}
            onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="Please sign this document"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email Body</label>
          <textarea
            value={formData.emailBody}
            onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[100px]"
            placeholder="Please review and sign the attached document..."
            required
          />
        </div>

        {/* Signers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium">Signers</label>
            <button
              type="button"
              onClick={addSigner}
              className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium"
            >
              + Add Signer
            </button>
          </div>

          <div className="space-y-4">
            {formData.signers.map((signer, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Signer {index + 1}</h4>
                  {formData.signers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSigner(index)}
                      className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) => updateSigner(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={signer.email}
                      onChange={(e) => updateSigner(index, 'email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Routing Order</label>
                    <input
                      type="number"
                      value={signer.routingOrder}
                      onChange={(e) => updateSigner(index, 'routingOrder', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      min="1"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower numbers sign first</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Creating Envelope...' : 'Create & Send for Signature'}
        </button>
      </form>
    </div>
  );

  const renderTrackTab = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Track Envelope Status</h2>

      <form onSubmit={handleCheckStatus} className="mb-8">
        <div className="flex space-x-4">
          <input
            type="text"
            value={envelopeId}
            onChange={(e) => setEnvelopeId(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="Enter Envelope ID"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {envelopeStatus && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Envelope Details</h3>
              <p className="text-sm text-gray-500">ID: {envelopeStatus.envelopeId}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                envelopeStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                envelopeStatus.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                envelopeStatus.status === 'voided' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {envelopeStatus.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Created At</p>
              <p className="font-medium">{new Date(envelopeStatus.createdAt).toLocaleString()}</p>
            </div>
            {envelopeStatus.completedAt && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Completed At</p>
                <p className="font-medium">{new Date(envelopeStatus.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Signers Status */}
          <div className="mb-6">
            <h4 className="font-semibold mb-3">Signers</h4>
            <div className="space-y-3">
              {envelopeStatus.signers.map((signer, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{signer.name}</p>
                    <p className="text-sm text-gray-600">{signer.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      signer.status === 'completed' ? 'bg-green-100 text-green-800' :
                      signer.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {signer.status}
                    </span>
                    {signer.signedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Signed: {new Date(signer.signedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            {envelopeStatus.status === 'completed' && (
              <button
                onClick={() => handleDownload(envelopeStatus.envelopeId)}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                Download Signed Document
              </button>
            )}
            {envelopeStatus.status === 'sent' && (
              <button
                onClick={() => handleVoidEnvelope(envelopeStatus.envelopeId)}
                className="flex-1 py-3 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50"
              >
                Void Envelope
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">DocuSign Integration</h1>
              <p className="text-gray-600">Electronic signature management</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Powered by</span>
              <span className="font-bold text-blue-600">DocuSign</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('create')}
              className={`pb-4 px-2 font-medium ${
                activeTab === 'create'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Create Envelope
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`pb-4 px-2 font-medium ${
                activeTab === 'track'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Track Status
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'create' && renderCreateTab()}
          {activeTab === 'track' && renderTrackTab()}

          {/* Info Box */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">About DocuSign Integration</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Legally binding electronic signatures</li>
              <li>• Sequential signing with routing orders</li>
              <li>• Real-time status tracking</li>
              <li>• Automatic email notifications to signers</li>
              <li>• Secure document storage and audit trail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
