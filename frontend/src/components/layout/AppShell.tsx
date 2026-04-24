import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

const navItems = [
  { to: '/teams', label: 'Teams', icon: '🏀' },
  { to: '/scouting', label: 'Scouting', icon: '🔍' },
  { to: '/tournaments', label: 'Tournaments', icon: '🏆' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" />
      <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AppShell() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top header */}
      <header className="h-14 flex-shrink-0 flex items-center gap-3 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          aria-controls="app-sidebar"
        >
          {isOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
        <span className="text-lg font-bold text-brand-600 dark:text-brand-400 select-none">SIP Scout</span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Backdrop */}
      {isOpen && (
        <div
          data-testid="nav-backdrop"
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in sidebar */}
      <aside
        id="app-sidebar"
        className={`fixed top-14 left-0 bottom-0 w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-50 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <nav className="flex-1 p-2 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{user?.email}</div>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `block text-sm mb-1 transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}`
            }
          >
            Account
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}
