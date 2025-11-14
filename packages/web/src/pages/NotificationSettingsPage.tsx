import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_bookings: boolean;
  email_approvals: boolean;
  email_payments: boolean;
  email_messages: boolean;
  email_marketing: boolean;
  email_system: boolean;
  push_bookings: boolean;
  push_approvals: boolean;
  push_payments: boolean;
  push_messages: boolean;
  push_system: boolean;
  email_digest: boolean;
  email_digest_frequency: 'realtime' | 'daily' | 'weekly';
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    loadPreferences();
    checkPushSupport();
  }, []);

  const checkPushSupport = () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      checkPushSubscription();
    }
  };

  const checkPushSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushSubscribed(!!subscription);
    } catch (error) {
      console.error('Failed to check push subscription:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.notifications.getPreferences();
      setPreferences(response.data);
    } catch (error: any) {
      setError(error.message || 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await api.notifications.updatePreferences(preferences);
      setSuccess('Notification preferences saved successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    try {
      setError('');

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Push notification permission denied');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // VAPID public key - should be configured in environment
          'YOUR_VAPID_PUBLIC_KEY_HERE'
        ),
      });

      // Send subscription to server
      await api.notifications.subscribePush(subscription.toJSON(), navigator.userAgent);

      setPushSubscribed(true);
      setSuccess('Push notifications enabled successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to enable push notifications');
    }
  };

  const handleDisablePushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        setPushSubscribed(false);
        setSuccess('Push notifications disabled');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to disable push notifications');
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load notification preferences</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-gray-600 mt-1">Manage how you receive notifications</p>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Global Channels */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <div>
                    <Label htmlFor="in_app_enabled">In-App Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications in the app</p>
                  </div>
                </div>
                <Switch
                  id="in_app_enabled"
                  checked={preferences.in_app_enabled}
                  onCheckedChange={(checked) => updatePreference('in_app_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-600" />
                  <div>
                    <Label htmlFor="email_enabled">Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                </div>
                <Switch
                  id="email_enabled"
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-gray-600" />
                  <div>
                    <Label htmlFor="push_enabled">Push Notifications</Label>
                    <p className="text-sm text-gray-500">
                      {pushSupported
                        ? 'Receive push notifications on this device'
                        : 'Push notifications are not supported on this browser'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pushSupported && !pushSubscribed && (
                    <Button size="sm" variant="outline" onClick={handleEnablePushNotifications}>
                      Enable Push
                    </Button>
                  )}
                  {pushSupported && pushSubscribed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDisablePushNotifications}
                    >
                      Disable Push
                    </Button>
                  )}
                  <Switch
                    id="push_enabled"
                    checked={preferences.push_enabled && pushSubscribed}
                    onCheckedChange={(checked) => updatePreference('push_enabled', checked)}
                    disabled={!pushSupported || !pushSubscribed}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Email Notification Types</CardTitle>
              <CardDescription>Choose which events trigger email notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email_bookings">Bookings</Label>
                <Switch
                  id="email_bookings"
                  checked={preferences.email_bookings}
                  onCheckedChange={(checked) => updatePreference('email_bookings', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email_approvals">Approvals</Label>
                <Switch
                  id="email_approvals"
                  checked={preferences.email_approvals}
                  onCheckedChange={(checked) => updatePreference('email_approvals', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email_payments">Payments</Label>
                <Switch
                  id="email_payments"
                  checked={preferences.email_payments}
                  onCheckedChange={(checked) => updatePreference('email_payments', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email_messages">Messages</Label>
                <Switch
                  id="email_messages"
                  checked={preferences.email_messages}
                  onCheckedChange={(checked) => updatePreference('email_messages', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email_system">System Updates</Label>
                <Switch
                  id="email_system"
                  checked={preferences.email_system}
                  onCheckedChange={(checked) => updatePreference('email_system', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email_marketing">Marketing & Promotions</Label>
                <Switch
                  id="email_marketing"
                  checked={preferences.email_marketing}
                  onCheckedChange={(checked) => updatePreference('email_marketing', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Push Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Push Notification Types</CardTitle>
              <CardDescription>Choose which events trigger push notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="push_bookings">Bookings</Label>
                <Switch
                  id="push_bookings"
                  checked={preferences.push_bookings}
                  onCheckedChange={(checked) => updatePreference('push_bookings', checked)}
                  disabled={!preferences.push_enabled || !pushSubscribed}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push_approvals">Approvals</Label>
                <Switch
                  id="push_approvals"
                  checked={preferences.push_approvals}
                  onCheckedChange={(checked) => updatePreference('push_approvals', checked)}
                  disabled={!preferences.push_enabled || !pushSubscribed}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push_payments">Payments</Label>
                <Switch
                  id="push_payments"
                  checked={preferences.push_payments}
                  onCheckedChange={(checked) => updatePreference('push_payments', checked)}
                  disabled={!preferences.push_enabled || !pushSubscribed}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push_messages">Messages</Label>
                <Switch
                  id="push_messages"
                  checked={preferences.push_messages}
                  onCheckedChange={(checked) => updatePreference('push_messages', checked)}
                  disabled={!preferences.push_enabled || !pushSubscribed}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push_system">System Updates</Label>
                <Switch
                  id="push_system"
                  checked={preferences.push_system}
                  onCheckedChange={(checked) => updatePreference('push_system', checked)}
                  disabled={!preferences.push_enabled || !pushSubscribed}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Digest */}
          <Card>
            <CardHeader>
              <CardTitle>Email Digest</CardTitle>
              <CardDescription>Group notifications into periodic digests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email_digest">Enable Email Digest</Label>
                <Switch
                  id="email_digest"
                  checked={preferences.email_digest}
                  onCheckedChange={(checked) => updatePreference('email_digest', checked)}
                  disabled={!preferences.email_enabled}
                />
              </div>
              <div>
                <Label htmlFor="digest_frequency">Digest Frequency</Label>
                <Select
                  value={preferences.email_digest_frequency}
                  onValueChange={(value) => updatePreference('email_digest_frequency', value)}
                  disabled={!preferences.email_digest || !preferences.email_enabled}
                >
                  <SelectTrigger id="digest_frequency" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>Pause notifications during specific hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="quiet_hours_enabled">Enable Quiet Hours</Label>
                <Switch
                  id="quiet_hours_enabled"
                  checked={preferences.quiet_hours_enabled}
                  onCheckedChange={(checked) => updatePreference('quiet_hours_enabled', checked)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet_hours_start">Start Time</Label>
                  <Input
                    id="quiet_hours_start"
                    type="time"
                    value={preferences.quiet_hours_start || ''}
                    onChange={(e) => updatePreference('quiet_hours_start', e.target.value)}
                    disabled={!preferences.quiet_hours_enabled}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet_hours_end">End Time</Label>
                  <Input
                    id="quiet_hours_end"
                    type="time"
                    value={preferences.quiet_hours_end || ''}
                    onChange={(e) => updatePreference('quiet_hours_end', e.target.value)}
                    disabled={!preferences.quiet_hours_enabled}
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={preferences.timezone}
                  onChange={(e) => updatePreference('timezone', e.target.value)}
                  placeholder="e.g., America/New_York"
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={loadPreferences}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
