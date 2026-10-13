import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AaoLogo } from '../components/ui/AaoBrand';
import {
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Building2,
  Store,
  Gift,
  Users,
  ClipboardCheck,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

export const OwnerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      to: '/owner/dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/owner/loyalty-programs',
      label: 'Loyalty Programs',
      icon: Gift,
      end: false,
    },
    {
      to: '/owner/visit-requests',
      label: 'Visit Requests',
      icon: ClipboardCheck,
      end: false,
    },
    {
      to: '/owner/branches',
      label: 'Locations',
      icon: Store,
      end: false,
    },
    {
      to: '/owner/staff',
      label: 'Staff',
      icon: Users,
      end: false,
    },
    {
      to: '/owner/business',
      label: 'Business Profile',
      icon: Building2,
      end: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033] flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-[#FFFFFF] px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
        {/* Left: Brand + Title */}
        <div className="flex items-center gap-3">
          <Link to="/owner/dashboard" className="flex items-center gap-2.5">
            <AaoLogo variant="icon" size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-[#172033] leading-none tracking-tight">AAO</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444]" />
              </div>
              <span className="block text-[10px] text-[#667085] font-bold uppercase tracking-wider mt-0.5">
                Business Owner Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-xs font-mono text-[#667085] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E5E7EB] truncate max-w-[220px]">
            {user?.email}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Owner</span>
          </span>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-slate-50 text-[#172033] text-xs font-bold transition-colors border border-[#E5E7EB] shadow-2xs cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 text-[#667085]" />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] text-[10px] font-black uppercase">
            Owner
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#172033] bg-[#F8FAFC] border border-[#E5E7EB] hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Desktop & Tablet Navigation Bar */}
      <nav className="hidden md:block bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center gap-1 lg:gap-2 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2.5 text-xs lg:text-sm font-bold border-b-2 transition-all whitespace-nowrap rounded-t-lg ${
                    isActive
                      ? 'border-[#FFD444] text-[#172033] bg-[#FFFDF5]'
                      : 'border-transparent text-[#667085] hover:text-[#172033] hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 stroke-[2.2]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden bg-slate-900/40 backdrop-blur-xs flex flex-col justify-start pt-14">
          <div className="bg-[#FFFFFF] border-b border-[#E5E7EB] shadow-xl p-4 space-y-3 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Signed in as</span>
                <span className="text-xs font-mono font-bold text-[#172033] truncate block">{user?.email}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#667085] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#FFF8E1] text-[#172033] border border-[#FFE08A]'
                        : 'text-[#667085] hover:bg-slate-50 hover:text-[#172033]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#172033] font-bold text-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#667085]" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Page Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
