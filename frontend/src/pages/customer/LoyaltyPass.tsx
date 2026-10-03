import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import type { PublicQrData, CustomerLoyaltyData, CustomerRewardItem } from '../../services/customerService';
import {
  Sparkles,
  Phone,
  KeyRound,
  CheckCircle2,
  Clock,
  Gift,
  ArrowRight,
  AlertCircle,
  Loader2,
  MapPin,
  Award,
  RefreshCw,
  LogOut,
  Check,
  ChevronDown,
  ChevronUp,
  QrCode,
  Copy,
  X,
  Star,
  History,
  Trophy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────────── */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function rewardLabel(reward: { rewardName?: string | null; rewardType: string }): string {
  return reward.rewardName || reward.rewardType.replace(/_/g, ' ');
}

/* ──────────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────────── */
export const LoyaltyPass: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { user, sendCustomerOtp, verifyCustomerOtp, logout } = useAuth();

  const [publicData, setPublicData] = useState<PublicQrData | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<CustomerLoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inline OTP Auth States
  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);

  // Visit Request States
  const [isRequestingVisit, setIsRequestingVisit] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Expandable sections
  const [showRedeemed, setShowRedeemed] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Reward QR Modal state
  const [selectedRewardForQr, setSelectedRewardForQr] = useState<CustomerRewardItem | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  /* ── Data Loading ──────────────────────────────────────────────────────── */
  const loadPublicData = useCallback(async () => {
    if (!qrToken) return;
    try {
      setError(null);
      const data = await customerService.resolvePublicQr(qrToken);
      setPublicData(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Invalid or expired QR code');
    } finally {
      setIsLoading(false);
    }
  }, [qrToken]);

  const loadLoyaltyStatus = useCallback(async () => {
    if (!qrToken || !user || user.role !== 'CUSTOMER') return;
    try {
      const data = await customerService.getLoyaltyStatus(qrToken);
      setLoyaltyData(data);
    } catch (err: any) {
      console.error('Failed to load loyalty status:', err);
    }
  }, [qrToken, user]);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    if (user && user.role === 'CUSTOMER') {
      loadLoyaltyStatus();
    }
  }, [user, loadLoyaltyStatus]);

  // Polling: auto-poll every 3.5s when there is an active pending visit request,
  // or poll periodically (every 8s) to keep rewards in sync
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;

    const pollInterval = loyaltyData?.pendingRequest ? 3000 : 8000;
    const intervalId = setInterval(() => {
      loadLoyaltyStatus();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [loyaltyData?.pendingRequest, user, loadLoyaltyStatus]);

  /* ── Auth handlers ─────────────────────────────────────────────────────── */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setAuthError('Please enter a valid phone number');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const msg = await sendCustomerOtp(cleanPhone);
      setAuthInfo(msg || 'OTP sent successfully! Enter code below.');
      setAuthStep('OTP');
    } catch (err: any) {
      setAuthError(err.response?.data?.error?.message || err.message || 'Failed to send OTP');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!otp || otp.trim().length !== 6) {
      setAuthError('Please enter the 6-digit OTP code');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await verifyCustomerOtp(phone.trim(), otp.trim());
      setAuthStep('PHONE');
      setOtp('');
      await loadLoyaltyStatus();
    } catch (err: any) {
      setAuthError(err.response?.data?.error?.message || err.message || 'Invalid or expired OTP');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  /* ── Visit request handler ─────────────────────────────────────────────── */
  const handleRequestStamp = async () => {
    if (!qrToken) return;
    setIsRequestingVisit(true);
    setError(null);
    setActionSuccess(null);

    try {
      await customerService.createVisitRequest(qrToken);
      setActionSuccess('Stamp requested! Waiting for staff approval.');
      await loadLoyaltyStatus();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to request stamp');
    } finally {
      setIsRequestingVisit(false);
    }
  };

  /* ── History loader ────────────────────────────────────────────────────── */
  const loadHistory = async () => {
    if (historyData) {
      setShowHistory(!showHistory);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const data = await customerService.getCustomerHistory();
      setHistoryData(data);
      setShowHistory(true);
    } catch {
      // silently fail
    } finally {
      setIsLoadingHistory(false);
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────────── */
  const cycleLength = loyaltyData?.cycle?.cycleLength || publicData?.program.cycleLength || 5;
  const visitCount = loyaltyData?.cycle?.visitCount || 0;
  const cycleNumber = loyaltyData?.cycle?.cycleNumber || 1;
  const progressPercent = Math.min(100, Math.round((visitCount / cycleLength) * 100));

  const isAuthenticated = user && user.role === 'CUSTOMER';

  const nextMilestone = useMemo(() => {
    const milestones = loyaltyData?.milestones || publicData?.program.milestones;
    if (!milestones) return null;
    return milestones.find(
      (m: any) => m.visitNumber > visitCount && m.rewardType !== 'NONE'
    ) || null;
  }, [loyaltyData?.milestones, publicData?.program.milestones, visitCount]);

  const unlockedRewards: CustomerRewardItem[] = useMemo(() => {
    return loyaltyData?.unlockedRewards || [];
  }, [loyaltyData?.unlockedRewards]);

  const redeemedRewards: CustomerRewardItem[] = useMemo(() => {
    return loyaltyData?.redeemedRewards || [];
  }, [loyaltyData?.redeemedRewards]);

  // Recent visits from history for the current business
  const recentVisits = useMemo(() => {
    if (!historyData || !loyaltyData) return [];
    const businessHistory = historyData.find(
      (h: any) => h.business?.name === loyaltyData.business.name
    );
    if (!businessHistory) return [];
    const visits: any[] = [];
    for (const cycle of businessHistory.cycles || []) {
      for (const visit of cycle.visits || []) {
        visits.push({
          ...visit,
          cycleNumber: cycle.cycleNumber,
          programName: cycle.programName,
        });
      }
    }
    visits.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return visits.slice(0, 10);
  }, [historyData, loyaltyData]);

  /* ── Loading / Error states ────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-slate-500">Loading loyalty pass…</p>
      </div>
    );
  }

  if (error && !publicData) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-7 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">QR Code Error</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">{error}</p>
          <button
            onClick={loadPublicData}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#FAFBFC] font-sans flex flex-col items-center pb-10">
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 leading-tight truncate">
              {publicData?.business.name || loyaltyData?.business.name || 'Loyalty Pass'}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{publicData?.branch.name || loyaltyData?.branch.name}</span>
            </p>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                  {loyaltyData?.customer.name || 'Customer'}
                </p>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="w-full max-w-md px-4 mt-5 space-y-4">
        {/* ── Global Alerts ────────────────────────────────────────────────── */}
        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── AUTHENTICATION (only when not logged in) ───────────────────── */}
        {!isAuthenticated && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Check in with your phone</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your mobile number to view your stamps and rewards.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-4 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            {authInfo && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{authInfo}</span>
              </div>
            )}

            {authStep === 'PHONE' ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Continue with SMS</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Enter 6-digit OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      autoFocus
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Verify & Open Pass</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('PHONE');
                      setOtp('');
                      setAuthError(null);
                    }}
                    className="hover:text-slate-900 transition-colors"
                  >
                    Change Number
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isAuthSubmitting}
                    className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend OTP</span>
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LOYALTY PASS (authenticated only, or public preview)
           ═══════════════════════════════════════════════════════════════════ */}

        {/* ─── HERO: STAMP CARD ──────────────────────────────────────────── */}
        <section
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          {/* Customer greeting bar */}
          {isAuthenticated && loyaltyData && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-sm text-slate-500">
                Welcome back, <span className="font-semibold text-slate-800">{loyaltyData.customer.name || 'there'}</span>
              </p>
            </div>
          )}

          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Top line: program name + cycle badge */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-indigo-600 mb-0.5">
                  {publicData?.program.name || loyaltyData?.program.name || 'Loyalty Program'}
                </p>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
                  {visitCount}
                  <span className="text-slate-400 font-bold text-lg"> / {cycleLength}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">stamps collected</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 shrink-0">
                Cycle {cycleNumber}
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {nextMilestone ? (
                <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
                  <span>
                    {nextMilestone.visitNumber - visitCount} stamp{nextMilestone.visitNumber - visitCount !== 1 ? 's' : ''} until next reward
                  </span>
                  <span className="text-indigo-600 font-semibold truncate max-w-[140px]">
                    {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                  </span>
                </p>
              ) : visitCount >= cycleLength ? (
                <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                  Cycle complete! Start your next visit to begin a new cycle.
                </p>
              ) : null}
            </div>

            {/* ── Stamp punch grid ─────────────────────────────────────────── */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <div
                className={`grid gap-2 ${
                  cycleLength <= 5
                    ? 'grid-cols-5'
                    : cycleLength <= 8
                    ? 'grid-cols-4'
                    : cycleLength <= 10
                    ? 'grid-cols-5'
                    : 'grid-cols-6'
                }`}
              >
                {Array.from({ length: cycleLength }, (_, i) => {
                  const stampNum = i + 1;
                  const isStamped = stampNum <= visitCount;
                  const milestones = publicData?.program.milestones || [];
                  const milestoneOnStamp = milestones.find(
                    (m) => m.visitNumber === stampNum && m.rewardType !== 'NONE'
                  );

                  return (
                    <div
                      key={stampNum}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                        isStamped
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : milestoneOnStamp
                          ? 'bg-amber-50 border-amber-300 border-dashed text-amber-700'
                          : 'bg-white border-slate-200 border-dashed text-slate-400'
                      }`}
                    >
                      {isStamped ? (
                        <Check className="w-5 h-5 text-white stroke-[2.5]" />
                      ) : milestoneOnStamp ? (
                        <>
                          <Gift className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[9px] font-bold text-amber-700 leading-none mt-0.5">
                            {stampNum}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-medium">{stampNum}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Primary CTA: Request Stamp ──────────────────────────────── */}
            {isAuthenticated && (
              <div>
                {loyaltyData?.pendingRequest ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900 leading-tight">
                          Stamp Pending
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Show your screen to staff
                        </p>
                      </div>
                    </div>
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                  </div>
                ) : (
                  <button
                    onClick={handleRequestStamp}
                    disabled={isRequestingVisit}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isRequestingVisit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Requesting…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Request a Stamp</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ─── NEXT REWARD CARD ──────────────────────────────────────────── */}
        {nextMilestone && (
          <section
            className="bg-white border border-slate-200 rounded-2xl p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">Next Reward</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-extrabold text-indigo-600 leading-none">
                  {nextMilestone.visitNumber}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">stamps</p>
              </div>
            </div>
            {(nextMilestone as any).rewardDescription && (
              <p className="text-xs text-slate-500 mt-2 ml-[52px]">
                {(nextMilestone as any).rewardDescription}
              </p>
            )}
          </section>
        )}

        {/* ─── UNLOCKED REWARDS ──────────────────────────────────────────── */}
        {isAuthenticated && unlockedRewards.length > 0 && (
          <section
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <Gift className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Your Rewards</h3>
              <span className="ml-auto px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                {unlockedRewards.length} ready
              </span>
            </div>

            <div className="space-y-2.5">
              {unlockedRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/60 overflow-hidden"
                >
                  <div className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-600 text-white rounded">
                          Unlocked
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          Cycle {reward.cycleNumber}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {rewardLabel(reward)}
                      </p>
                      {reward.rewardDescription && (
                        <p className="text-xs text-slate-500 mt-0.5">{reward.rewardDescription}</p>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRewardForQr(reward);
                        setCopiedToken(false);
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Show Reward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── REDEEMED REWARDS HISTORY ──────────────────────────────────── */}
        {isAuthenticated && redeemedRewards.length > 0 && (
          <section
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <button
              type="button"
              onClick={() => setShowRedeemed(!showRedeemed)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span>Redeemed Rewards ({redeemedRewards.length})</span>
              </span>
              {showRedeemed ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showRedeemed && (
              <div className="px-5 pb-4 space-y-2">
                {redeemedRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {rewardLabel(reward)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Used {formatDate(reward.redeemedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-500 shrink-0">
                      Redeemed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── NO REWARDS YET (empty state) ──────────────────────────────── */}
        {isAuthenticated && unlockedRewards.length === 0 && redeemedRewards.length === 0 && (
          <section
            className="bg-white border border-slate-200 rounded-2xl p-6 text-center"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No rewards yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Keep collecting stamps to unlock rewards!
            </p>
          </section>
        )}

        {/* ─── MILESTONES TIMELINE ───────────────────────────────────────── */}
        {(loyaltyData?.milestones || publicData?.program.milestones) && (
          <section
            className="bg-white border border-slate-200 rounded-2xl p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Milestones</h3>
            </div>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

              <div className="space-y-0">
                {(loyaltyData?.milestones || publicData?.program.milestones || []).map(
                  (m: any, idx: number) => {
                    const isReached = visitCount >= m.visitNumber;
                    const isReward = m.rewardType !== 'NONE';
                    const milestoneStatus = m.status || (isReached ? 'UNLOCKED' : 'LOCKED');
                    const isUnlocked = milestoneStatus === 'UNLOCKED';
                    const isRedeemed = milestoneStatus === 'REDEEMED';

                    return (
                      <div key={m.id || idx} className="relative flex items-start gap-3 py-2.5">
                        {/* Circle indicator */}
                        <div
                          className={`relative z-10 w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isRedeemed
                              ? 'bg-slate-100 border-slate-300 text-slate-400'
                              : isUnlocked && isReward
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : isReached
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : isReward
                              ? 'bg-amber-50 border-amber-300 text-amber-600'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {isRedeemed ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : isReached ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : isReward ? (
                            <Gift className="w-3 h-3" />
                          ) : (
                            <span className="text-[11px] font-bold">{m.visitNumber}</span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-sm font-medium truncate ${
                                isRedeemed
                                  ? 'text-slate-400 line-through'
                                  : isUnlocked
                                  ? 'text-emerald-800'
                                  : isReached
                                  ? 'text-slate-800'
                                  : 'text-slate-600'
                              }`}
                            >
                              {isReward
                                ? m.rewardName || m.rewardType.replace(/_/g, ' ')
                                : `Visit ${m.visitNumber}`}
                            </p>
                            {isReward && (
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                  isRedeemed
                                    ? 'bg-slate-100 text-slate-400'
                                    : isUnlocked
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isReached
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {isRedeemed ? 'Redeemed' : isUnlocked ? 'Unlocked' : isReached ? 'Reached' : 'Locked'}
                              </span>
                            )}
                          </div>
                          {isReward && m.rewardDescription && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {m.rewardDescription}
                            </p>
                          )}
                          {!isReward && (
                            <p className="text-xs text-slate-400">Checkpoint</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── VISIT HISTORY ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <section
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <span>Visit History</span>
              </span>
              {isLoadingHistory ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              ) : showHistory ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showHistory && recentVisits.length > 0 && (
              <div className="px-5 pb-4 space-y-1.5">
                {recentVisits.map((visit: any, idx: number) => (
                  <div
                    key={visit.id || idx}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">
                          Visit #{visit.visitNumberInCycle}
                          <span className="text-slate-400 text-xs ml-1">· Cycle {visit.cycleNumber}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">
                      {formatDate(visit.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {showHistory && recentVisits.length === 0 && (
              <div className="px-5 pb-4">
                <p className="text-sm text-slate-400 text-center py-3">No visits recorded yet.</p>
              </div>
            )}
          </section>
        )}

        {/* ─── FOOTER: LOCATION & BRANDING ───────────────────────────────── */}
        <footer className="pt-2 pb-2 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {publicData?.branch.name || loyaltyData?.branch.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {publicData?.branch.address || loyaltyData?.branch.address || 'In-store location'}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400">
              Powered by <span className="font-medium text-slate-500">RetainPulse</span>
            </p>
          </div>
        </footer>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          REWARD QR / CODE MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {selectedRewardForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center relative flex flex-col items-center"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <button
              type="button"
              onClick={() => setSelectedRewardForQr(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <Gift className="w-5 h-5" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              {selectedRewardForQr.rewardName || 'Reward'}
            </h3>
            {selectedRewardForQr.rewardDescription && (
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                {selectedRewardForQr.rewardDescription}
              </p>
            )}

            {/* QR Code */}
            <div className="my-5 p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
              {selectedRewardForQr.redemptionToken ? (
                <QRCodeSVG
                  value={selectedRewardForQr.redemptionToken}
                  size={180}
                  level="H"
                  includeMargin
                />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center text-sm text-slate-400">
                  Token not available
                </div>
              )}
            </div>

            {/* Redemption Code + Copy */}
            {selectedRewardForQr.redemptionToken && (
              <div className="w-full mb-4">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                  Redemption Code
                </p>
                <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 py-2.5 px-3 rounded-xl">
                  <span className="font-mono text-sm font-bold text-slate-800 tracking-wider">
                    {selectedRewardForQr.redemptionToken}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRewardForQr.redemptionToken) {
                        navigator.clipboard.writeText(selectedRewardForQr.redemptionToken);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1"
                    title="Copy code"
                  >
                    {copiedToken ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 px-3 w-full">
              Show this reward to staff to redeem at checkout.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
