import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, LogOut, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export const StaffDashboard: React.FC = () => {
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
            <h1 className="font-semibold text-base text-slate-900 leading-tight">Staff Portal</h1>
            <p className="text-xs text-slate-500">Branch Operations & Stamp Approvals</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>STAFF</span>
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Staff Session Overview</h2>
          <p className="text-slate-500 text-sm mb-6">
            You are authorized to verify in-store customer visits and process reward redemptions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Staff User ID</span>
              <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.id}</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Email</span>
              <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.email || 'N/A'}</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Assigned Business ID</span>
              <p className="text-xs font-mono text-indigo-600 font-medium mt-1 truncate">{user?.businessId || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Operational Queues Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Pending Visit Stamp Requests</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-[11px] font-semibold">
                Live Queue
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When customers scan the branch QR code and submit a stamp request, pending visits will appear here for one-tap verification.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Reward Redemptions</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[11px] font-semibold">
                Redemption Terminal
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verify customer pass codes and record redeemed free drinks, discounts, or vouchers at point of service.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
