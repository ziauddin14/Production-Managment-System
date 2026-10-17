import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../contracts/auth';
import { ACTIVE_MODULES, DASHBOARD_NAV, PLANNED_MODULES, type NavItem } from '../navigation';

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-emerald-400',
    isActive
      ? 'bg-emerald-800 text-white'
      : 'text-emerald-50/90 hover:bg-emerald-800/60 hover:text-white',
  ].join(' ');
}

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink to={item.path} end={item.path === '/'} className={navClass} onClick={onNavigate}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        {item.plannedMilestone && (
          <span
            className="rounded bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
            title={`Planned for ${item.plannedMilestone}`}
          >
            {item.plannedMilestone}
          </span>
        )}
      </NavLink>
    </li>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-bold text-emerald-800"
          aria-hidden="true"
        >
          MAB
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">MAB PMS</p>
          <p className="text-xs text-emerald-100/80">Production Management</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="space-y-1">
          <NavEntry item={DASHBOARD_NAV} onNavigate={onNavigate} />
          {ACTIVE_MODULES.map((item) => (
            <NavEntry key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
          Planned modules
        </p>
        <ul className="mt-2 space-y-1">
          {PLANNED_MODULES.map((item) => (
            <NavEntry key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function AppLayout() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  // The menu is open only on the page where it was opened, so any navigation closes it.
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen = menuOpenedAt === location.pathname;
  const [signingOut, setSigningOut] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenuOpenedAt(null), []);
  const openMenu = () => setMenuOpenedAt(location.pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpenedAt(null);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const user = session?.user;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-emerald-900 lg:block">
        <SidebarContent onNavigate={closeMenu} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            aria-hidden="true"
            data-testid="menu-overlay"
            onClick={closeMenu}
          />
          <div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-emerald-900 shadow-xl"
          >
            <button
              type="button"
              onClick={closeMenu}
              className="absolute right-3 top-4 rounded p-1 text-emerald-50 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={closeMenu} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={openMenu}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-slate-800 lg:hidden">MAB PMS</p>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.displayName}</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>

        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
