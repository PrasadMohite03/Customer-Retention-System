import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AaoLogo, AaoMascot } from '../components/ui/AaoBrand';

export const Login: React.FC = () => {
  const { loginOwnerOrStaff } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await loginOwnerOrStaff({ email, password });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#172033] flex flex-col justify-between relative selection:bg-[#FFD444]/30 selection:text-[#172033] font-sans overflow-x-hidden">
      {/* Ambient Warm Golden Glow Backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-b from-[#FFF0A8]/70 via-[#FFF8D6]/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-16 -left-20 w-80 h-80 bg-[#FFE57F]/30 rounded-full blur-3xl" />
        <div className="absolute top-24 -right-20 w-80 h-80 bg-[#FFD444]/25 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="border-b border-[#E5E7EB]/80 bg-[#FFFFFF]/85 backdrop-blur-md px-6 sm:px-10 py-3.5 flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <AaoLogo variant="full" size="sm" />
        </Link>
        <Link 
          to="/customer/login"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#172033] bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] shadow-xs hover:bg-[#FFFDF5] transition-all"
        >
          <span>Customer Pass</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#667085]" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl shadow-xl shadow-amber-500/5 p-7 sm:p-9">
          <div className="text-center mb-6">
            {/* Mascot Banner Moment */}
            <div className="mb-3 flex justify-center">
              <AaoMascot mood="hello" size={72} />
            </div>

            {/* Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD444]/20 border border-[#FFD444]/40 text-[#172033] text-[11px] font-black uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444]" />
              <span>Business Portal</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight">Business Sign In</h1>
            <p className="text-xs text-[#667085] mt-1.5">Manage your AAO loyalty program, staff & counter QR</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#475467] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@business.com"
                  required
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#FFD444] focus:ring-4 focus:ring-[#FFD444]/20 rounded-xl px-4 py-2.5 pl-10 text-[#172033] placeholder:text-[#94A3B8] text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#475467]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:bg-white focus:border-[#FFD444] focus:ring-4 focus:ring-[#FFD444]/20 rounded-xl px-4 py-2.5 pl-10 text-[#172033] placeholder:text-[#94A3B8] text-sm focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs border border-[#EAB308]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-3 text-sm cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#172033]" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-[#E5E7EB] text-center space-y-2">
            <p className="text-xs text-[#667085]">
              Need to register a new store?{' '}
              <Link to="/register" className="text-[#172033] hover:text-[#D97706] hover:underline font-extrabold transition-colors">
                Create Owner Account
              </Link>
            </p>
            <p className="text-xs text-[#667085]">
              Are you a customer?{' '}
              <Link to="/customer/login" className="text-[#172033] hover:text-[#D97706] hover:underline font-extrabold transition-colors">
                Customer Phone Login
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB]/80 bg-[#FFFFFF]/80 py-4 text-center text-xs text-[#667085]">
        AAO • Scan. Earn. Come Again.
      </footer>
    </div>
  );
};
