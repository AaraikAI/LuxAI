import { Outlet, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Plane, Sparkles, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-luxury-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Plane className="h-8 w-8 text-luxury-800" />
              <Link to="/" className="font-serif text-2xl font-bold text-luxury-900">
                LuxAI Designer
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/itineraries"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Itineraries
                  </Link>
                  <Link
                    to="/aviation"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Private Aviation
                  </Link>
                  <Link
                    to="/approvals"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Approvals
                  </Link>
                  <Link
                    to="/vendor/dashboard"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Vendor Portal
                  </Link>
                  <Link
                    to="/docusign"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    DocuSign
                  </Link>
                  <Link
                    to="/vault"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Vault
                  </Link>
                  <Link
                    to="/flights"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Flights
                  </Link>
                  <Link
                    to="/forum"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Forum
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/reports"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors"
                  >
                    Reports
                  </Link>
                  <Link
                    to="/itineraries/new"
                    className="flex items-center space-x-1 btn-primary"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Trip</span>
                  </Link>
                  <div className="flex items-center space-x-3 pl-4 border-l border-luxury-300">
                    <span className="text-sm text-luxury-600">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <button
                      onClick={logout}
                      className="p-2 text-luxury-600 hover:text-luxury-900 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary">
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-6 w-6 text-luxury-800" />
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-luxury-200">
              {isAuthenticated ? (
                <div className="flex flex-col space-y-3">
                  <Link
                    to="/dashboard"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/itineraries"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Itineraries
                  </Link>
                  <Link
                    to="/aviation"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Private Aviation
                  </Link>
                  <Link
                    to="/approvals"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Approvals
                  </Link>
                  <Link
                    to="/vendor/dashboard"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Vendor Portal
                  </Link>
                  <Link
                    to="/docusign"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    DocuSign
                  </Link>
                  <Link
                    to="/vault"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Vault
                  </Link>
                  <Link
                    to="/flights"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Flights
                  </Link>
                  <Link
                    to="/forum"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Forum
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/reports"
                    className="text-luxury-700 hover:text-luxury-900 transition-colors px-2"
                  >
                    Reports
                  </Link>
                  <Link to="/itineraries/new" className="btn-primary w-full">
                    Generate Trip
                  </Link>
                  <button onClick={logout} className="btn-secondary w-full">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  <Link to="/login" className="btn-secondary w-full">
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary w-full">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-luxury-900 text-luxury-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm">
              &copy; 2024 LuxAI Designer. Your World, Anticipated.
            </p>
            <p className="text-xs text-luxury-400 mt-2">
              AI-Powered Luxury for the Ultra-Elite
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
