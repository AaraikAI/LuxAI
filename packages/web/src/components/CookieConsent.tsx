import { useState, useEffect } from 'react';
import { Cookie, X, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export default function CookieConsent() {
  const { isAuthenticated } = useAuthStore();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    // Check if user has already consented (stored in localStorage for non-authenticated users)
    const localConsent = localStorage.getItem('cookieConsent');

    if (!localConsent) {
      // Show banner after a short delay
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = async (prefs: ConsentPreferences) => {
    try {
      // Save to localStorage
      localStorage.setItem('cookieConsent', JSON.stringify(prefs));

      // If authenticated, also save to backend
      if (isAuthenticated) {
        await api.gdpr.updateConsent(prefs);
      }

      setShowBanner(false);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save consent preferences:', error);
      // Still save locally even if API fails
      localStorage.setItem('cookieConsent', JSON.stringify(prefs));
      setShowBanner(false);
      setShowSettings(false);
    }
  };

  const acceptAll = () => {
    const allAccepted: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    setPreferences(allAccepted);
    saveConsent(allAccepted);
  };

  const acceptNecessary = () => {
    const necessaryOnly: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setPreferences(necessaryOnly);
    saveConsent(necessaryOnly);
  };

  const saveCustomPreferences = () => {
    saveConsent(preferences);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-gold-100 rounded-lg">
                <Cookie className="h-5 w-5 text-gold-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  We value your privacy
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We use cookies to enhance your browsing experience, analyze our traffic,
                  and personalize content. By clicking "Accept All", you consent to our use
                  of cookies. You can manage your preferences or learn more in our{' '}
                  <a href="/privacy-policy" className="text-gold-600 hover:text-gold-700 underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Customize
              </button>
              <button
                onClick={acceptNecessary}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Necessary Only
              </button>
              <button
                onClick={acceptAll}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-gold-500 to-gold-600 rounded-lg hover:from-gold-600 hover:to-gold-700 shadow-md hover:shadow-lg transition-all"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold-100 rounded-lg">
                  <Settings className="h-5 w-5 text-gold-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Cookie Preferences
                </h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-600">
                We use different types of cookies to optimize your experience on our website.
                Click on the categories below to learn more and change our default settings.
                Please note that blocking some types of cookies may impact your experience.
              </p>

              {/* Cookie Categories */}
              <div className="space-y-4">
                {/* Necessary Cookies */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">
                      Necessary Cookies
                    </h3>
                    <div className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                      Always Active
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    These cookies are essential for the website to function properly.
                    They enable core functionality such as security, network management,
                    and accessibility.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">
                      Analytics Cookies
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) =>
                          setPreferences({ ...preferences, analytics: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-slate-600">
                    These cookies help us understand how visitors interact with our website,
                    which pages are visited most often, and if users get error messages.
                  </p>
                </div>

                {/* Marketing Cookies */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">
                      Marketing Cookies
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) =>
                          setPreferences({ ...preferences, marketing: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-slate-600">
                    These cookies are used to track visitors across websites to display
                    relevant and personalized advertisements.
                  </p>
                </div>

                {/* Functional Cookies */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">
                      Functional Cookies
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) =>
                          setPreferences({ ...preferences, functional: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-slate-600">
                    These cookies enable enhanced functionality and personalization,
                    such as videos and live chat.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={acceptNecessary}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={saveCustomPreferences}
                className="flex-1 px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-gold-500 to-gold-600 rounded-lg hover:from-gold-600 hover:to-gold-700 shadow-md hover:shadow-lg transition-all"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
