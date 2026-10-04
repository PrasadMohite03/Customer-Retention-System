import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import type { PublicQrData, CustomerLoyaltyData, CustomerRewardItem } from '../../services/customerService';
import {
  Phone,
  KeyRound,
  CheckCircle2,
  Clock,
  Gift,
  ArrowRight,
  ArrowLeft,
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
  Star,
  History,
  Trophy,
} from 'lucide-react';
import { RewardQrModal } from '../../components/customer/RewardQrModal';

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
  const navigate = useNavigate();
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
  const cycleLength = loyaltyData?.cycle?.cycleLength || publicData?.program.cycleLength || 4;
  const qualifyingSlots = cycleLength;
  const totalVisualSlots = cycleLength + 1;
  const visitCount = loyaltyData?.cycle?.visitCount || 0;
  const cycleNumber = loyaltyData?.cycle?.cycleNumber || 1;

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

  const activeUnlockedReward = useMemo(() => {
    return unlockedRewards.find((r) => r.isCurrentCycle) || unlockedRewards[0] || null;
  }, [unlockedRewards]);

  const latestRedeemedReward = useMemo(() => {
    return redeemedRewards.find((r) => r.isCurrentCycle) || redeemedRewards[0] || null;
  }, [redeemedRewards]);

  const isCycleCompleted = useMemo(() => {
    return (
      Boolean((loyaltyData?.cycle as any)?.isCycleCompleted) ||
      loyaltyData?.cycle?.status === 'COMPLETED' ||
      visitCount >= cycleLength
    );
  }, [loyaltyData?.cycle, visitCount, cycleLength]);

  const isRewardRedeemed = useMemo(() => {
    if (activeUnlockedReward) return false;
    if (isCycleCompleted && latestRedeemedReward) return true;
    const finalMilestone = loyaltyData?.milestones?.find((m) => m.visitNumber === cycleLength);
    if (finalMilestone?.status === 'REDEEMED') return true;
    return false;
  }, [activeUnlockedReward, isCycleCompleted, latestRedeemedReward, loyaltyData?.milestones, cycleLength]);

  const completedVisualCount = useMemo(() => {
    if (isRewardRedeemed) {
      return totalVisualSlots;
    }
    return Math.min(qualifyingSlots, visitCount);
  }, [isRewardRedeemed, totalVisualSlots, qualifyingSlots, visitCount]);

  const progressPercent = Math.min(100, Math.round((completedVisualCount / totalVisualSlots) * 100));

  // Deduplicated unlocked rewards: exclude the one already highlighted in the hero card
  const otherUnlockedRewards = useMemo(() => {
    if (!activeUnlockedReward) return unlockedRewards;
    return unlockedRewards.filter((r) => r.id !== activeUnlockedReward.id);
  }, [unlockedRewards, activeUnlockedReward]);

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
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-7 h-7 animate-spin text-[#FFD444] mb-3" />
        <p className="text-sm text-[#667085]">Loading loyalty pass…</p>
      </div>
    );
  }

  if (error && !publicData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-[#E5E7EB] rounded-2xl p-7 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#172033]">QR Code Error</h2>
          <p className="text-sm text-[#667085] mt-1 mb-6">{error}</p>
          <button
            onClick={loadPublicData}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center pb-10">
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-[#E5E7EB] px-4 py-3.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate('/customer/dashboard')}
                title="Back to Loyalty Cards"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#172033] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#172033] leading-tight truncate">
                {publicData?.business.name || loyaltyData?.business.name || 'Loyalty Pass'}
              </h1>
              <p className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-[#667085] shrink-0" />
                <span className="truncate">{publicData?.branch.name || loyaltyData?.branch.name}</span>
              </p>
            </div>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/customer/dashboard')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#172033] text-xs font-bold transition-colors cursor-pointer"
              >
                My Cards
              </button>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#667085] hover:text-[#172033] flex items-center justify-center transition-colors cursor-pointer"
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
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-[#172033] flex items-center justify-center mx-auto mb-3">
                <Phone className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-[#172033]">Check in with your phone</h2>
              <p className="text-sm text-[#667085] mt-1">
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
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[#172033] text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#16A34A]" />
                <span>{authInfo}</span>
              </div>
            )}

            {authStep === 'PHONE' ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD444]/40 focus:border-[#FFD444] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.98]"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-[#172033]" /> : <ArrowRight className="w-4 h-4 text-[#172033]" />}
                  <span>Continue with SMS</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1.5">
                    Enter 6-digit OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      autoFocus
                      required
                      className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD444]/40 focus:border-[#FFD444] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.98]"
                >
                  {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-[#172033]" /> : <Check className="w-4 h-4 text-[#172033]" />}
                  <span>Verify & Open Pass</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1 text-[#667085]">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('PHONE');
                      setOtp('');
                      setAuthError(null);
                    }}
                    className="hover:text-[#172033] transition-colors font-medium"
                  >
                    Change Number
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isAuthSubmitting}
                    className="text-[#172033] font-bold hover:underline inline-flex items-center gap-1"
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
          className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs"
        >
          {/* Customer greeting bar */}
          {isAuthenticated && loyaltyData && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-xs text-[#667085]">
                Welcome back, <span className="font-bold text-[#172033]">{loyaltyData.customer.name || 'there'}</span>
              </p>
            </div>
          )}

          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Top line: program name + cycle badge */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#667085] mb-0.5">
                  {publicData?.program.name || loyaltyData?.program.name || 'Loyalty Program'}
                </p>
                <h2 className="text-2xl font-extrabold text-[#172033] tracking-tight leading-none">
                  {completedVisualCount} of {totalVisualSlots}
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  {isRewardRedeemed
                    ? 'Reward redeemed • Cycle completed'
                    : `${visitCount} qualifying visit${visitCount !== 1 ? 's' : ''} completed`}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 border border-[#E5E7EB] text-[#667085] shrink-0">
                Cycle {cycleNumber}
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#55E07E] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {activeUnlockedReward ? (
                <p className="text-xs font-bold mt-1.5 flex items-center justify-between text-[#172033]">
                  <span className="text-[#0E7A36] flex items-center gap-1 font-bold">
                    <span>Reward Ready</span>
                  </span>
                  <span className="truncate max-w-[160px] text-[#172033] font-bold">
                    {rewardLabel(activeUnlockedReward)}
                  </span>
                </p>
              ) : isRewardRedeemed ? (
                <p className="text-xs font-bold mt-1.5 flex items-center justify-between text-[#172033]">
                  <span className="text-[#0E7A36] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Reward Redeemed</span>
                  </span>
                  <span className="truncate max-w-[160px] text-[#667085] font-normal">
                    {latestRedeemedReward ? rewardLabel(latestRedeemedReward) : 'Completed'}
                  </span>
                </p>
              ) : nextMilestone && !isCycleCompleted ? (
                <p className="text-xs text-[#667085] mt-1.5 flex items-center justify-between">
                  <span>
                    {qualifyingSlots - visitCount} visit{qualifyingSlots - visitCount !== 1 ? 's' : ''} until next reward
                  </span>
                  <span className="text-[#172033] font-bold truncate max-w-[140px]">
                    {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                  </span>
                </p>
              ) : isCycleCompleted ? (
                <p className="text-xs text-[#0E7A36] font-bold mt-1.5">
                  Cycle complete! Your next qualifying visit starts a new cycle.
                </p>
              ) : null}
            </div>

            {/* ── Stamp punch grid (5 visual slots: 4 qualifying + 1 reward) ──────────────── */}
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-3.5">
              <div
                className={`grid gap-2 ${
                  totalVisualSlots <= 5
                    ? 'grid-cols-5'
                    : totalVisualSlots <= 8
                    ? 'grid-cols-4'
                    : 'grid-cols-5'
                }`}
              >
                {Array.from({ length: totalVisualSlots }, (_, i) => {
                  const slotNum = i + 1;
                  const isRewardSlot = slotNum === totalVisualSlots;
                  const isCompletedQualifying = slotNum <= visitCount && !isRewardSlot;
                  const isCompletedReward = isRewardSlot && isRewardRedeemed;
                  const isCompleted = isCompletedQualifying || isCompletedReward;

                  const milestones = publicData?.program.milestones || [];
                  const milestoneOnSlot = milestones.find(
                    (m) => m.visitNumber === slotNum && m.rewardType !== 'NONE'
                  );

                  if (isCompleted) {
                    return (
                      <div
                        key={slotNum}
                        className="aspect-square rounded-xl bg-[#EAFBEF] border-2 border-[#55E07E] flex flex-col items-center justify-center shadow-xs transition-all"
                      >
                        <Check className="w-5 h-5 text-[#0E7A36] stroke-[3]" />
                      </div>
                    );
                  }

                  if (isRewardSlot) {
                    return (
                      <div
                        key={slotNum}
                        className="aspect-square rounded-xl bg-[#EAFBEF] border-2 border-dashed border-[#55E07E] flex flex-col items-center justify-center transition-all shadow-xs"
                      >
                        <Gift className="w-4 h-4 text-[#16A34A]" />
                        <span className="text-[10px] font-bold text-[#0E7A36] leading-none mt-1">
                          Reward
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotNum}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                        milestoneOnSlot
                          ? 'bg-[#EAFBEF]/40 border-2 border-[#55E07E]/40 border-dashed text-[#172033]'
                          : 'bg-[#FFFFFF] border-2 border-slate-200 border-dashed text-[#667085]'
                      }`}
                    >
                      {milestoneOnSlot ? (
                        <>
                          <Gift className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span className="text-[9px] font-bold text-[#172033] leading-none mt-0.5">
                            {slotNum}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-[#667085]">{slotNum}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Action Section: Show Reward OR Redeemed State OR Request Stamp ───────────── */}
            {isAuthenticated && (
              <div>
                {activeUnlockedReward ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-[11px] font-extrabold tracking-wide">
                        <Gift className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>REWARD READY</span>
                      </div>
                      <span className="text-xs font-semibold text-[#0E7A36]">
                        Ready to Redeem
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-[#172033] leading-tight">
                        {rewardLabel(activeUnlockedReward)}
                      </h3>
                      <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                        You completed all {qualifyingSlots} qualifying visits. Show this QR to staff to redeem your reward.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRewardForQr(activeUnlockedReward)}
                      className="w-full py-3 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <QrCode className="w-4 h-4 stroke-[2.5]" />
                      <span>Show Reward</span>
                    </button>
                  </div>
                ) : isRewardRedeemed && latestRedeemedReward ? (
                  <div className="rounded-2xl border border-[#55E07E]/40 bg-[#EAFBEF] p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#55E07E]/40 text-[#0E7A36] text-[11px] font-extrabold tracking-wide">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>REWARD REDEEMED</span>
                      </div>
                      {latestRedeemedReward.redeemedAt && (
                        <span className="text-xs font-medium text-[#0E7A36]">
                          Redeemed on {formatDate(latestRedeemedReward.redeemedAt)}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#172033] leading-tight">
                        {rewardLabel(latestRedeemedReward)}
                      </h3>
                      <p className="text-xs text-[#667085] mt-1">
                        Your next qualifying visit starts a new loyalty cycle.
                      </p>
                    </div>
                  </div>
                ) : loyaltyData?.pendingRequest ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#EAFBEF] text-[#16A34A] flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-[#16A34A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#172033] leading-tight">
                          Stamp Pending
                        </p>
                        <p className="text-xs text-[#667085] mt-0.5">
                          Show your screen to staff
                        </p>
                      </div>
                    </div>
                    <Loader2 className="w-4 h-4 text-[#16A34A] animate-spin shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleRequestStamp}
                      disabled={isRequestingVisit}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
                    >
                      {isRequestingVisit ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#172033]" />
                          <span>Requesting…</span>
                        </>
                      ) : (
                        <span>Request a Stamp</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ─── NEXT REWARD CARD ──────────────────────────────────────────── */}
        {nextMilestone && !activeUnlockedReward && !isCycleCompleted && !isRewardRedeemed && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-[#E5E7EB] text-[#FFD444] flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-[#FFD444]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#667085]">Next Reward</p>
                <p className="text-sm font-bold text-[#172033] truncate">
                  {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-extrabold text-[#172033] leading-none">
                  {nextMilestone.visitNumber}
                </p>
                <p className="text-[10px] text-[#667085] font-medium">stamps</p>
              </div>
            </div>
            {(nextMilestone as any).rewardDescription && (
              <p className="text-xs text-[#667085] mt-2 ml-[52px]">
                {(nextMilestone as any).rewardDescription}
              </p>
            )}
          </section>
        )}

        {/* ─── UNLOCKED REWARDS (secondary / historical, excluding activeUnlockedReward) ── */}
        {isAuthenticated && otherUnlockedRewards.length > 0 && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EAFBEF] border border-[#55E07E]/30 text-[#16A34A] flex items-center justify-center">
                <Gift className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033]">
                {activeUnlockedReward ? 'Other Ready Rewards' : 'Your Rewards'}
              </h3>
              <span className="ml-auto px-2 py-0.5 text-[11px] font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 rounded-full">
                {otherUnlockedRewards.length} ready
              </span>
            </div>

            <div className="space-y-2.5">
              {otherUnlockedRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden"
                >
                  <div className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#EAFBEF] border border-[#55E07E]/30 text-[#16A34A] flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 rounded">
                          Reached
                        </span>
                        <span className="text-[11px] text-[#667085]">
                          Cycle {reward.cycleNumber}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#172033]">
                        {rewardLabel(reward)}
                      </p>
                      {reward.rewardDescription && (
                        <p className="text-xs text-[#667085] mt-0.5">{reward.rewardDescription}</p>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRewardForQr(reward);
                      }}
                      className="w-full py-2.5 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
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
            className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs"
          >
            <button
              type="button"
              onClick={() => setShowRedeemed(!showRedeemed)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-[#172033] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                <span>Redeemed Rewards ({redeemedRewards.length})</span>
              </span>
              {showRedeemed ? (
                <ChevronUp className="w-4 h-4 text-[#667085]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#667085]" />
              )}
            </button>

            {showRedeemed && (
              <div className="px-5 pb-4 space-y-2">
                {redeemedRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="p-3 rounded-xl border border-[#E5E7EB] bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#172033] truncate">
                          {rewardLabel(reward)}
                        </p>
                        <p className="text-xs text-[#667085]">
                          Used {formatDate(reward.redeemedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-[#667085] shrink-0">
                      Redeemed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── NO REWARDS YET (empty state) ──────────────────────────────── */}
        {isAuthenticated && !activeUnlockedReward && unlockedRewards.length === 0 && redeemedRewards.length === 0 && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl p-6 text-center shadow-xs"
          >
            <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#172033]">No rewards yet</p>
            <p className="text-xs text-[#667085] mt-1">
              Keep collecting stamps to unlock rewards!
            </p>
          </section>
        )}

        {/* ─── MILESTONES TIMELINE ───────────────────────────────────────── */}
        {(loyaltyData?.milestones || publicData?.program.milestones) && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#EAFBEF] border border-[#55E07E]/30 text-[#16A34A] flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-[#172033]">Milestones</h3>
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
                              ? 'bg-slate-100 border-slate-300 text-[#667085]'
                              : isReached || isUnlocked
                              ? 'bg-[#EAFBEF] border-2 border-[#55E07E] text-[#0E7A36]'
                              : isReward
                              ? 'bg-[#F8FAFC] border-2 border-dashed border-slate-300 text-[#667085]'
                              : 'bg-white border-slate-200 text-[#667085]'
                          }`}
                        >
                          {isRedeemed ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : isReached || isUnlocked ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : isReward ? (
                            <Gift className="w-3.5 h-3.5" />
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
                                  ? 'text-[#667085] line-through'
                                  : isReached || isUnlocked
                                  ? 'text-[#172033] font-bold'
                                  : 'text-[#667085]'
                              }`}
                            >
                              {isReward
                                ? m.rewardName || m.rewardType.replace(/_/g, ' ')
                                : `Visit ${m.visitNumber}`}
                            </p>
                            {isReward && (
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                  isRedeemed
                                    ? 'bg-slate-100 text-[#667085]'
                                    : isReached || isUnlocked
                                    ? 'bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30'
                                    : 'bg-slate-100 text-[#667085]'
                                }`}
                              >
                                {isRedeemed ? 'Redeemed' : (isReached || isUnlocked) ? 'Reached' : 'Locked'}
                              </span>
                            )}
                          </div>
                          {isReward && m.rewardDescription && (
                            <p className="text-xs text-[#667085] mt-0.5 truncate">
                              {m.rewardDescription}
                            </p>
                          )}
                          {!isReward && (
                            <p className="text-xs text-[#667085]">Checkpoint</p>
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
            className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs"
          >
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-[#172033] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#667085]" />
                <span>Visit History</span>
              </span>
              {isLoadingHistory ? (
                <Loader2 className="w-4 h-4 text-[#667085] animate-spin" />
              ) : showHistory ? (
                <ChevronUp className="w-4 h-4 text-[#667085]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#667085]" />
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
                      <div className="w-6 h-6 rounded-full bg-[#EAFBEF] text-[#16A34A] flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#172033]">
                          Visit #{visit.visitNumberInCycle}
                          <span className="text-[#667085] text-xs ml-1">· Cycle {visit.cycleNumber}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-[#667085] shrink-0">
                      {formatDate(visit.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {showHistory && recentVisits.length === 0 && (
              <div className="px-5 pb-4">
                <p className="text-sm text-[#667085] text-center py-3">No visits recorded yet.</p>
              </div>
            )}
          </section>
        )}

        {/* ─── FOOTER: LOCATION & BRANDING ───────────────────────────────── */}
        <footer className="pt-2 pb-2 space-y-3">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#667085] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#172033]">
                  {publicData?.branch.name || loyaltyData?.branch.name}
                </p>
                <p className="text-xs text-[#667085] mt-0.5">
                  {publicData?.branch.address || loyaltyData?.branch.address || 'In-store location'}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-[#667085]">
              Powered by <span className="font-semibold text-[#172033]">RetainPulse</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Reward QR Code Modal */}
      <RewardQrModal
        reward={selectedRewardForQr}
        businessName={loyaltyData?.business.name || publicData?.business.name}
        onClose={() => setSelectedRewardForQr(null)}
      />
    </div>
  );
};
