import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

enum LiveUpdateType {
  DELAY = 'delay',
  GATE_CHANGE = 'gate_change',
  CANCELLATION = 'cancellation',
  TRAFFIC = 'traffic',
  WEATHER = 'weather',
  GENERAL = 'general',
}

enum LiveUpdatePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

interface LiveUpdate {
  id: string;
  type: LiveUpdateType;
  title: string;
  message: string;
  priority: LiveUpdatePriority;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  createdAt: string;
}

export const LiveUpdatesManagementPage: React.FC = () => {
  const { itineraryId } = useParams<{ itineraryId: string }>();
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    type: LiveUpdateType.GENERAL,
    title: '',
    message: '',
    priority: LiveUpdatePriority.MEDIUM,
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
  });

  useEffect(() => {
    if (itineraryId) {
      loadUpdates();
    }
  }, [itineraryId]);

  const loadUpdates = async () => {
    try {
      const response = await api.liveUpdates.getByItinerary(itineraryId!);
      setUpdates(response.data);
    } catch (error) {
      console.error('Failed to load live updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.liveUpdates.create({
        itineraryId: itineraryId!,
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
      });

      setShowCreateForm(false);
      setFormData({
        type: LiveUpdateType.GENERAL,
        title: '',
        message: '',
        priority: LiveUpdatePriority.MEDIUM,
        startTime: new Date().toISOString().slice(0, 16),
        endTime: '',
      });
      loadUpdates();
      alert('Live update created and sent to client devices!');
    } catch (error) {
      console.error('Failed to create live update:', error);
      alert('Failed to create live update. Please try again.');
    }
  };

  const handleEndUpdate = async (updateId: string) => {
    if (!confirm('Are you sure you want to end this live update?')) return;

    try {
      await api.liveUpdates.end(updateId);
      loadUpdates();
      alert('Live update ended successfully.');
    } catch (error) {
      console.error('Failed to end live update:', error);
      alert('Failed to end live update. Please try again.');
    }
  };

  const getPriorityColor = (priority: LiveUpdatePriority) => {
    switch (priority) {
      case LiveUpdatePriority.URGENT:
        return 'red';
      case LiveUpdatePriority.HIGH:
        return 'orange';
      case LiveUpdatePriority.MEDIUM:
        return 'yellow';
      case LiveUpdatePriority.LOW:
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getTypeIcon = (type: LiveUpdateType) => {
    switch (type) {
      case LiveUpdateType.DELAY:
        return '⏰';
      case LiveUpdateType.GATE_CHANGE:
        return '🚪';
      case LiveUpdateType.CANCELLATION:
        return '❌';
      case LiveUpdateType.TRAFFIC:
        return '🚗';
      case LiveUpdateType.WEATHER:
        return '🌦️';
      default:
        return 'ℹ️';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading live updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Live Updates</h1>
            <p className="text-gray-600">Manage real-time notifications for iOS & Android</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
          >
            + Create Update
          </button>
        </div>

        {/* Platform Info Banner */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">Multi-Platform Live Updates</h3>
              <p className="text-sm text-purple-800 mb-3">
                Updates are automatically delivered to both iOS and Android devices with platform-specific features:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <span className="text-xl">📱</span>
                  <div>
                    <p className="font-medium text-purple-900">iOS Live Activities</p>
                    <p className="text-xs text-purple-700">Lock screen & Dynamic Island integration</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-xl">🤖</span>
                  <div>
                    <p className="font-medium text-purple-900">Android Live Updates</p>
                    <p className="text-xs text-purple-700">Persistent notification with updates</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
              <h2 className="text-2xl font-bold mb-6">Create Live Update</h2>

              <form onSubmit={handleCreateUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Update Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as LiveUpdateType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value={LiveUpdateType.GENERAL}>General</option>
                    <option value={LiveUpdateType.DELAY}>Delay</option>
                    <option value={LiveUpdateType.GATE_CHANGE}>Gate Change</option>
                    <option value={LiveUpdateType.CANCELLATION}>Cancellation</option>
                    <option value={LiveUpdateType.TRAFFIC}>Traffic</option>
                    <option value={LiveUpdateType.WEATHER}>Weather</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as LiveUpdatePriority })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value={LiveUpdatePriority.LOW}>Low</option>
                    <option value={LiveUpdatePriority.MEDIUM}>Medium</option>
                    <option value={LiveUpdatePriority.HIGH}>High</option>
                    <option value={LiveUpdatePriority.URGENT}>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Flight Delayed"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                    placeholder="Provide detailed information about the update..."
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">End Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Create & Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Updates List */}
        <div className="space-y-4">
          {updates.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 mb-4">No live updates for this itinerary yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create First Update
              </button>
            </div>
          ) : (
            updates.map((update) => {
              const priorityColor = getPriorityColor(update.priority);
              return (
                <div
                  key={update.id}
                  className={`bg-white rounded-lg shadow-lg p-6 border-l-4 border-${priorityColor}-500`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <span className="text-3xl">{getTypeIcon(update.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold">{update.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${priorityColor}-100 text-${priorityColor}-800`}>
                            {update.priority.toUpperCase()}
                          </span>
                          {update.isActive ? (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ENDED
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-3">{update.message}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Start: {new Date(update.startTime).toLocaleString()}</span>
                          {update.endTime && (
                            <span>End: {new Date(update.endTime).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {update.isActive && (
                      <button
                        onClick={() => handleEndUpdate(update.id)}
                        className="ml-4 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                      >
                        End Update
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
