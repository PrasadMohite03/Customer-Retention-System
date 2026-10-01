import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ShieldCheck, UserCheck, Layers, Store, ExternalLink, Sparkles } from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-6 sm:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-base text-slate-900 leading-tight">Business Owner Portal</h1>
            <p className="text-xs text-slate-500">Customer Retention Management</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>OWNER</span>
          </span>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors border border-slate-200 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8 space-y-6">
        {/* Welcome Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back, Owner</h2>
            <p className="text-slate-500 text-sm">
              Your business workspace is authenticated and active. Review tenant scopes and administrative services.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">User ID</span>
              <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.id}</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Email</span>
              <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.email || 'N/A'}</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Business Scope ID</span>
              <p className="text-xs font-mono text-indigo-600 font-medium mt-1 truncate">{user?.businessId || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
                <Store className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base mb-1">Branch Management</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Configure physical store branches, addresses, and individual branch QR tokens.</p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
              <span>Ready for Configuration</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base mb-1">Loyalty Engine</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Set up cycle lengths, milestone discount checkpoints, and free item redemptions.</p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
              <span>Ready for Setup</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
                <UserCheck className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base mb-1">Staff Access</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Create staff accounts, toggle active statuses, and assign operational branch scopes.</p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
              <span>Ready for Management</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
