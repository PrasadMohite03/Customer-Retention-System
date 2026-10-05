import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Phone, KeyRound, ArrowRight, AlertCircle, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { AaoLogo, AaoMascot } from '../components/ui/AaoBrand';

export const CustomerLogin: React.FC = () => {
  const { sendCustomerOtp, verifyCustomerOtp } = useAuth();

  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!phone || phone.trim().length < 8) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      const msg = await sendCustomerOtp(phone);
      setInfoMessage(msg || 'OTP sent successfully! Check dev logs in demo mode.');
      setStep('OTP');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyCustomerOtp(phone, otp);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP';
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
          to="/login"
          className="text-xs sm:text-sm font-bold text-[#667085] hover:text-[#172033] transition-colors"
        >
          Business Portal &rarr;
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl shadow-sm p-7 sm:p-8">
          <div className="text-center mb-6">
            <div className="mb-3 flex justify-center">
              <AaoMascot mood="hello" size={72} />
            </div>
            <h1 className="text-2xl font-black text-[#172033] tracking-tight">Customer Sign In</h1>
            <p className="text-xs text-[#667085] mt-1">
              {step === 'PHONE' ? 'Scan. Earn. Come Again. Enter your phone to get started.' : `Enter the 6-digit OTP code sent to ${phone}`}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/70 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {step === 'PHONE' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 pl-10 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-sm cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 pl-10 text-slate-900 text-center tracking-[0.5em] text-base font-mono placeholder:text-slate-400 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('PHONE');
                    setOtp('');
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Change Phone Number
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSubmitting}
                  className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Code</span>
                </button>
              </div>
            </form>
          )}

          <div className="mt-7 pt-5 border-t border-[#E5E7EB] text-center">
            <p className="text-xs text-[#667085]">
              Business Owner or Staff?{' '}
              <Link to="/login" className="text-[#172033] hover:underline font-bold transition-colors">
                Sign in to Business Portal
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#FFFFFF] py-4 text-center text-xs text-[#667085]">
        AAO • Scan. Earn. Come Again.
      </footer>
    </div>
  );
};
