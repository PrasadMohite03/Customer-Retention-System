import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Phone, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';
import { AaoLogo, AaoMascot } from '../components/ui/AaoBrand';

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033] flex flex-col justify-between relative selection:bg-[#FFD444]/30 selection:text-[#172033] font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFFFF]/90 backdrop-blur-md px-6 sm:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AaoLogo variant="full" size="sm" />
        </div>

        <nav className="flex items-center gap-3">
          <Link
            to="/customer/login"
            className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-[#172033] hover:bg-slate-100 transition-colors"
          >
            Customer Pass
          </Link>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] shadow-xs transition-colors"
          >
            Business Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 sm:px-8 pt-10 pb-16 flex flex-col items-center justify-center text-center relative z-10">
        {/* Mascot Banner Moment */}
        <div className="mb-4">
          <AaoMascot mood="hello" size={90} className="mx-auto" />
        </div>

        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#E5E7EB] shadow-xs text-[#172033] text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-[#FFD444]" />
          <span>Scan. Earn. Come Again.</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#172033] max-w-3xl leading-[1.12] mb-4">
          Bring Customers Back With Simple Loyalty & Rewards
        </h1>

        {/* Hero Description */}
        <p className="text-base sm:text-lg text-[#667085] max-w-2xl leading-relaxed mb-8">
          AAO helps local businesses create friendly digital punch cards, automated milestone rewards, and instant OTP check-ins that customers love.
        </p>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#667085] mb-10">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            No apps to download
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            Instant mobile phone check-in
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            Real scannable store QR codes
          </span>
        </div>

        {/* Action Entry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left">
          {/* Customer Card */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFD444]/20 border border-[#FFD444]/40 flex items-center justify-center text-[#172033] mb-4">
                <Phone className="w-5 h-5 stroke-[2.2]" />
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-bold text-[#172033]">
                  Customers & Diners
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30">
                  Customer
                </span>
              </div>

              <p className="text-xs text-[#667085] leading-relaxed mb-6">
                Check in at your favorite stores, collect stamps on your digital loyalty card, and unlock vouchers.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E5E7EB]">
              <Link
                to="/customer/login"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-colors"
              >
                <span>Customer Phone Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Business Card */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#172033] mb-4">
                <Building2 className="w-5 h-5" />
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-lg font-bold text-[#172033]">
                  Store Owners & Staff
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-[#667085] border border-slate-200">
                  Business
                </span>
              </div>

              <p className="text-xs text-[#667085] leading-relaxed mb-6">
                Set up your loyalty program, print branch QR standees, approve visits, and validate customer reward vouchers.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-stretch gap-2.5">
              <Link
                to="/register"
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#172033] hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Register Store
              </Link>
              <Link
                to="/login"
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-[#E5E7EB] text-[#172033] text-xs font-bold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#FFFFFF] py-5 text-center text-xs text-[#667085]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-bold text-[#172033]">AAO — Simple Loyalty & Rewards</span>
          <span>Scan. Earn. Come Again.</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
