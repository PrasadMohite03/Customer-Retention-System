import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Phone, ArrowRight, Sparkles, Building2, CheckCircle2 } from 'lucide-react';

const Home: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    switch (user.role) {
      case 'OWNER':
        return <Navigate to="/owner/dashboard" replace />;
      case 'STAFF':
        return <Navigate to="/staff/dashboard" replace />;
      case 'CUSTOMER':
        return <Navigate to="/customer/dashboard" replace />;
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex flex-col justify-between relative selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      {/* Subtle Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_60%,transparent_100%)] opacity-70"
        aria-hidden="true" 
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-6 sm:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-slate-900">
            RetainPulse
          </span>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            to="/customer/login"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
          >
            Customer Pass
          </Link>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
          >
            Business Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 sm:px-8 pt-12 pb-16 flex flex-col items-center justify-center text-center relative z-10">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200/90 shadow-xs text-slate-700 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
          <span>Milestone-Based Digital Loyalty Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.12] mb-5">
          Turn Every Visit Into a{' '}
          <span className="text-indigo-600">Lasting Relationship</span>
        </h1>

        {/* Hero Description */}
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mb-10">
          Streamlined QR stamp tracking, automated milestone rewards, and instant OTP verification built for cafes, salons, gyms, and retail stores.
        </p>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500 mb-12">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            No hardware or app downloads
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Instant 6-digit phone OTP
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Branch & multi-tenant isolation
          </span>
        </div>

        {/* Action Entry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left">
          {/* Business Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-100/70 transition-colors">
                <Building2 className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-semibold text-slate-900">
                  Business Owners & Staff
                </h2>
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  Portal
                </span>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Create custom loyalty cycles, print branch QR codes, invite staff members, and track customer redemption history.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch gap-2.5">
              <Link
                to="/register"
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-xs transition-colors"
              >
                Register Business
              </Link>
              <Link
                to="/login"
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Customer Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-100/70 transition-colors">
                <Phone className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-semibold text-slate-900">
                  Customers & Diners
                </h2>
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  Member
                </span>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Log in via your phone number to view collected stamps, unlocked discounts, and redeem rewards during your visits.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/customer/login"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium shadow-xs transition-colors"
              >
                <span>Customer OTP Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Customer Retention SaaS System</span>
          <span className="text-slate-400">Secure, multi-tenant digital loyalty engine</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
