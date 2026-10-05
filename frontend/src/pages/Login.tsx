import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AaoLogo } from '../components/ui/AaoBrand';

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033] flex flex-col justify-between relative selection:bg-[#FFD444]/30 selection:text-[#172033] font-sans">
      {/* Top Bar */}
      <header className="border-b border-[#E5E7EB] bg-[#FFFFFF]/90 backdrop-blur-md px-6 sm:px-10 py-3.5 flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <AaoLogo variant="full" size="sm" />
        </Link>
        <Link 
          to="/customer/login"
          className="text-xs sm:text-sm font-bold text-[#667085] hover:text-[#172033] transition-colors"
        >
          Customer Pass &rarr;
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl shadow-sm p-7 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-[#172033] mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[#172033] tracking-tight">Business Portal</h1>
            <p className="text-xs text-[#667085] mt-1">Sign in to manage your AAO loyalty program & staff</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@business.com"
                  required
                  className="w-full bg-[#F8FAFC] border border-[#E5E7EB] focus:bg-white focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 rounded-xl px-4 py-2.5 pl-10 text-[#172033] placeholder:text-[#667085] text-xs focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#F8FAFC] border border-[#E5E7EB] focus:bg-white focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 rounded-xl px-4 py-2.5 pl-10 text-[#172033] placeholder:text-[#667085] text-xs focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#172033] hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-xs cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-[#E5E7EB] text-center space-y-2">
            <p className="text-xs text-[#667085]">
              Need to register a new store?{' '}
              <Link to="/register" className="text-[#172033] hover:underline font-bold transition-colors">
                Create Owner Account
              </Link>
            </p>
            <p className="text-xs text-[#667085]">
              Are you a customer?{' '}
              <Link to="/customer/login" className="text-[#172033] hover:underline font-bold transition-colors">
                Customer Phone Login
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#FFFFFF] py-4 text-center text-xs text-[#667085]">
        AAO • Multi-tenant Merchant & Staff Management
      </footer>
    </div>
  );
};
