import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, LogOut, Menu, X, ChevronDown, User } from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const DropdownMenu = ({ title, items }: { title: string; items: { label: string; path: string }[] }) => {
    const isOpen = activeDropdown === title;

    return (
      <div
        className="relative"
        onMouseEnter={() => setActiveDropdown(title)}
        onMouseLeave={() => setActiveDropdown(null)}
      >
        <button className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-gold-600 transition-colors py-2">
          {title}
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-gold-600 transition-colors"
                onClick={() => setActiveDropdown(null)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Premium Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-sm bg-white/95">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="p-2 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-display text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  LuxAI
                </div>
                <div className="text-xs text-slate-500 tracking-wider uppercase">Designer</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium text-slate-700 hover:text-gold-600 transition-colors"
                  >
                    Dashboard
                  </Link>

                  <DropdownMenu
                    title="Travel"
                    items={[
                      { label: 'My Itineraries', path: '/itineraries' },
                      { label: 'Private Aviation', path: '/aviation' },
                      { label: 'Flight Search', path: '/flights' },
                      { label: 'Approvals', path: '/approvals' },
                    ]}
                  />

                  <DropdownMenu
                    title="Services"
                    items={[
                      { label: 'The Vault', path: '/vault' },
                      { label: 'Vendor Portal', path: '/vendor/dashboard' },
                      { label: 'DocuSign', path: '/docusign' },
                    ]}
                  />

                  <DropdownMenu
                    title="Insights"
                    items={[
                      { label: 'Analytics', path: '/analytics' },
                      { label: 'Reports', path: '/reports' },
                      { label: 'Community Forum', path: '/forum' },
                    ]}
                  />

                  {/* CTA Button */}
                  <Link
                    to="/itineraries/new"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-gold-600 hover:to-gold-700 transition-all"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Trip
                  </Link>

                  {/* User Menu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveDropdown('user')}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-slate-900">
                          {user?.firstName}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${activeDropdown === 'user' ? 'rotate-180' : ''}`} />
                    </button>

                    {activeDropdown === 'user' && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <div className="text-sm font-medium text-slate-900">
                            {user?.firstName} {user?.lastName}
                          </div>
                          <div className="text-xs text-slate-500">{user?.email}</div>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-slate-700 hover:text-gold-600 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-gold-600 hover:to-gold-700 transition-all"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 py-4">
              {isAuthenticated ? (
                <div className="flex flex-col space-y-1">
                  <Link
                    to="/dashboard"
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/itineraries"
                    className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Itineraries
                  </Link>
                  <Link
                    to="/aviation"
                    className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Private Aviation
                  </Link>
                  <Link
                    to="/vault"
                    className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    The Vault
                  </Link>
                  <Link
                    to="/forum"
                    className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Community Forum
                  </Link>
                  <Link
                    to="/analytics"
                    className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-gold-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Analytics
                  </Link>

                  <div className="pt-4 mt-4 border-t border-slate-200">
                    <Link
                      to="/itineraries/new"
                      className="block w-full px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold text-center rounded-lg shadow-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Sparkles className="inline h-4 w-4 mr-2" />
                      Generate Trip
                    </Link>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200">
                    <div className="px-4 py-2 text-xs text-slate-500">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="inline h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  <Link
                    to="/login"
                    className="px-4 py-2.5 text-sm font-medium text-center text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold text-center rounded-lg shadow-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
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

      {/* Premium Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="font-display text-2xl font-bold bg-gradient-to-r from-gold-400 to-gold-500 bg-clip-text text-transparent mb-2">
              LuxAI Designer
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Your World, Anticipated.
            </p>
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} LuxAI Designer. AI-Powered Luxury for the Ultra-Elite.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
