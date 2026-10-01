import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Phone, LogOut, Award, QrCode, Sparkles, CheckCircle2 } from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
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
            <h1 className="font-semibold text-base text-slate-900 leading-tight">Customer Loyalty Pass</h1>
            <p className="text-xs text-slate-500">Verified Rewards Profile</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>VERIFIED</span>
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

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-6">
        {/* Customer Identity Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-3">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Active Member</span>
              </span>
              <h2 className="text-2xl font-bold text-slate-900">{user?.name || 'Valued Customer'}</h2>
              <p className="text-sm font-mono text-slate-600 mt-1 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{user?.phone || 'Phone Verified'}</span>
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Customer ID</span>
              <p className="text-xs font-mono text-slate-700 mt-0.5">{user?.id || user?.customerId}</p>
            </div>
          </div>
        </div>

        {/* Loyalty Activity Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">Scan Branch QR Code</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When visiting participating cafes, salons, or stores, scan their in-store QR code to automatically register your stamp request.
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">Milestone Rewards</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Earn free drinks, percentage discounts, or fixed vouchers as you progress through your personalized loyalty cycles.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
