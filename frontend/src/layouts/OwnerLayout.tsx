import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  ClipboardCheck,
} from 'lucide-react';

export const OwnerLayout: React.FC = () => {
  const { user, logout } = useAuth();

  const navItems = [
    {
      to: '/owner/dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/owner/business',
      label: 'Business Profile',
      icon: Building2,
      end: false,
    },
    {
      to: '/owner/branches',
      label: 'Branches',
      icon: GitBranch,
      end: false,
    },
    {
      to: '/owner/staff',
      label: 'Staff',
      icon: Users,
      end: false,
    },
    {
      to: '/owner/visit-requests',
      label: 'Visit Requests',
      icon: ClipboardCheck,
      end: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/owner/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-base text-slate-900 leading-tight">RetainPulse</span>
              <span className="block text-[11px] text-slate-500 font-medium">Business Owner Portal</span>
            </div>
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 truncate max-w-[200px]">
            {user?.email}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>OWNER</span>
          </span>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors border border-slate-200 shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Navigation Subheader / Tabs */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Main Page Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
};
