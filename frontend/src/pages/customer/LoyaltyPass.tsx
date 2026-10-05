import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import type {
  CustomerRewardItem,
  RewardClaimData,
} from '../../services/customerService';
import {
  Phone,
  KeyRound,
  CheckCircle2,
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
  Sparkles,
} from 'lucide-react';
import { RewardQrModal } from '../../components/customer/RewardQrModal';
import { ClaimRewardQrModal } from '../../components/customer/ClaimRewardQrModal';
import { AaoMascot, AaoLogo } from '../../components/ui/AaoBrand';

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

function getSlotRewardLabel(milestone: {
  rewardName?: string | null;
  rewardType: string;
  rewardValue?: string | null;
}): string {
  if (milestone.rewardName) {
    return milestone.rewardName;
  }
  if (milestone.rewardValue) {
    if (milestone.rewardType === 'DISCOUNT_PERCENTAGE' || milestone.rewardType === 'PERCENT_DISCOUNT') {
      return `${milestone.rewardValue}% Off`;
    }
    if (milestone.rewardType === 'DISCOUNT_FIXED' || milestone.rewardType === 'FIXED_DISCOUNT') {
      return `₹${milestone.rewardValue} Off`;
    }
  }
  switch (milestone.rewardType) {
    case 'FREE_SERVICE':
      return 'Free Service';
    case 'FREE_PRODUCT':
    case 'FREE_ITEM':
      return 'Free Item';
    case 'CUSTOM':
      return 'Reward';
    default:
      return milestone.rewardType.replace(/_/g, ' ');
  }
}

function getMilestoneRewardDetail(milestone: {
  rewardName?: string | null;
  rewardType?: string | null;
  rewardValue?: string | number | null;
  rewardDescription?: string | null;
}): string {
  const name = milestone.rewardName?.trim() || '';
  if (milestone.rewardType === 'FREE_ITEM' || milestone.rewardType === 'FREE_SERVICE' || milestone.rewardType === 'FREE_PRODUCT') {
    return name.toLowerCase().startsWith('free ') ? name : `Free ${name}`;
  }
  if (milestone.rewardValue) {
    if (milestone.rewardType === 'PERCENT_DISCOUNT' || milestone.rewardType === 'DISCOUNT_PERCENTAGE') {
      return `${milestone.rewardValue}% Off${name ? ` ${name}` : ''}`;
    }
    if (milestone.rewardType === 'FIXED_DISCOUNT' || milestone.rewardType === 'DISCOUNT_FIXED') {
      return `₹${milestone.rewardValue} Off${name ? ` ${name}` : ''}`;
    }
  }
  if (milestone.rewardDescription) {
    const cleaned = milestone.rewardDescription
      .replace(/^After \d+ qualifying visits/i, '')
      .replace(/^[,\s-–—:]+/, '')
      .trim();
    if (cleaned && cleaned.toLowerCase() !== name.toLowerCase()) {
      return cleaned;
    }
  }
  return name || (milestone.rewardType ? milestone.rewardType.replace(/_/g, ' ') : 'Reward');
}

/* ──────────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────────── */
export const LoyaltyPass: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const { user, sendCustomerOtp, verifyCustomerOtp, logout } = useAuth();
  const queryClient = useQueryClient();

  // Inline OTP Auth States
  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);

  // Visit Request States
  const [isRequestingVisit, setIsRequestingVisit] = useState<boolean>(false);

  // Reward Claim States (Claim Reward Visit flow)
  const [activeClaim, setActiveClaim] = useState<RewardClaimData | null>(null);
  const [isClaimingReward, setIsClaimingReward] = useState<boolean>(false);

  // Stamp Approval Tracking
  const [approvedAlert, setApprovedAlert] = useState<boolean>(false);
  const prevVisitCountRef = React.useRef<number | null>(null);
  const hadPendingRequestRef = React.useRef<boolean>(false);

  // Expandable sections
  const [showRedeemed, setShowRedeemed] = useState<boolean>(false);
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Reward QR Modal state
  const [selectedRewardForQr, setSelectedRewardForQr] = useState<CustomerRewardItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Complete cross-business state isolation: reset all local states when navigating between QR tokens
  useEffect(() => {
    prevVisitCountRef.current = null;
    hadPendingRequestRef.current = false;
    setActiveClaim(null);
    setSelectedRewardForQr(null);
    setHistoryData(null);
    setShowHistory(false);
    setActionError(null);
    setApprovedAlert(false);
  }, [qrToken]);

  /* ── TanStack Query: Public QR Resolution ──────────────────────────────── */
  const {
    data: publicData,
    isLoading: isPublicLoading,
    error: publicQueryError,
    refetch: refetchPublicData,
  } = useQuery({
    queryKey: ['public-qr', qrToken],
    queryFn: () => customerService.resolvePublicQr(qrToken!),
    enabled: Boolean(qrToken),
    staleTime: 1000 * 60 * 5,
  });

  /* ── TanStack Query: Customer Loyalty Status ───────────────────────────── */
  const {
    data: loyaltyData,
    isLoading: isLoyaltyLoading,
  } = useQuery({
    queryKey: ['customer-loyalty', qrToken],
    queryFn: () => customerService.getLoyaltyStatus(qrToken!),
    enabled: Boolean(qrToken && user && user.role === 'CUSTOMER'),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPendingVisit = Boolean(data?.pendingRequest);

      const isClaimConsumed = Boolean(
        activeClaim && data && (
          (data.cycle?.visitCount || 0) >= activeClaim.expectedVisitNumber ||
          data.redeemedRewards?.some(
            (r) => r.milestoneId === activeClaim.reward.id && r.isCurrentCycle
          )
        )
      );
      const hasActiveClaim = Boolean(activeClaim && !isClaimConsumed);

      if (hasPendingVisit || hasActiveClaim) {
        return 2500;
      }
      return false;
    },
  });

  const isLoading = isPublicLoading || (Boolean(user && user.role === 'CUSTOMER') && isLoyaltyLoading && !loyaltyData);
  const error = actionError || (publicQueryError ? ((publicQueryError as any)?.response?.data?.error?.message || (publicQueryError as Error)?.message || 'Invalid or expired QR code') : null);

  // Track staff approvals: trigger celebratory stamp alert only when visits increment after pending
  useEffect(() => {
    if (loyaltyData) {
      const currentVisits = loyaltyData.cycle?.visitCount || 0;
      const hasPending = Boolean(loyaltyData.pendingRequest);

      if (
        prevVisitCountRef.current !== null &&
        currentVisits > prevVisitCountRef.current &&
        hadPendingRequestRef.current
      ) {
        setApprovedAlert(true);
        const timer = setTimeout(() => setApprovedAlert(false), 7000);
        return () => clearTimeout(timer);
      }

      prevVisitCountRef.current = currentVisits;
      hadPendingRequestRef.current = hasPending;
    }
  }, [loyaltyData]);

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
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', qrToken] });
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
    setActionError(null);

    try {
      await customerService.createVisitRequest(qrToken);
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', qrToken] });
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to request stamp');
    } finally {
      setIsRequestingVisit(false);
    }
  };

  /* ── Reward Claim handler (special flow: no VisitRequest created) ───────── */
  const handleClaimRewardVisit = async () => {
    if (!qrToken) return;
    setIsClaimingReward(true);
    setActionError(null);

    try {
      const claimData = await customerService.createRewardClaim(qrToken);
      setActiveClaim(claimData);
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to generate reward claim token');
    } finally {
      setIsClaimingReward(false);
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
  const visitCount = loyaltyData?.cycle?.visitCount || 0;

  const isAuthenticated = user && user.role === 'CUSTOMER';

  const customerName = useMemo(() => {
    const raw = user?.name || loyaltyData?.customer?.name;
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed || ['customer', 'user', 'there', 'null', 'undefined'].includes(trimmed.toLowerCase())) {
      return null;
    }
    return trimmed.split(' ')[0];
  }, [user?.name, loyaltyData?.customer?.name]);

  const nextMilestone = useMemo(() => {
    const milestones = loyaltyData?.milestones || publicData?.program.milestones;
    if (!milestones) return null;
    return milestones.find(
      (m: any) => m.visitNumber > visitCount && m.rewardType && m.rewardType !== 'NONE'
    ) || null;
  }, [loyaltyData?.milestones, publicData?.program.milestones, visitCount]);

  const nextVisitNumber = visitCount + 1;

  const nextVisitMilestone = useMemo(() => {
    const milestones = loyaltyData?.milestones || publicData?.program.milestones;
    if (!milestones) return null;
    return milestones.find((m: any) => m.visitNumber === nextVisitNumber) || null;
  }, [loyaltyData?.milestones, publicData?.program.milestones, nextVisitNumber]);

  const isNextVisitReward = Boolean(
    nextVisitMilestone &&
    nextVisitMilestone.rewardType &&
    nextVisitMilestone.rewardType !== 'NONE'
  );

  const nextVisitRewardName = useMemo(() => {
    if (!nextVisitMilestone) return 'Reward';
    return (nextVisitMilestone as any).rewardName || (nextVisitMilestone as any).rewardType?.replace(/_/g, ' ') || 'Reward';
  }, [nextVisitMilestone]);

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

  const isNewVirtualCycle = useMemo(() => {
    return (
      (loyaltyData?.cycle?.id === null && !activeUnlockedReward) ||
      (visitCount === 0 && !activeUnlockedReward && ((loyaltyData?.cycle?.cycleNumber || 1) > 1 || Boolean((loyaltyData?.cycle as any)?.previousCycleNumber)))
    );
  }, [loyaltyData?.cycle, activeUnlockedReward, visitCount]);

  const isCycleCompleted = useMemo(() => {
    if (isNewVirtualCycle) return false;
    return (
      visitCount >= cycleLength &&
      (Boolean((loyaltyData?.cycle as any)?.isCycleCompleted) ||
        loyaltyData?.cycle?.status === 'COMPLETED' ||
        visitCount >= cycleLength)
    );
  }, [isNewVirtualCycle, loyaltyData?.cycle, visitCount, cycleLength]);

  const isRewardRedeemed = useMemo(() => {
    if (isNewVirtualCycle) return false;
    if (activeUnlockedReward) return false;
    return isCycleCompleted && Boolean(latestRedeemedReward?.isCurrentCycle);
  }, [isNewVirtualCycle, activeUnlockedReward, isCycleCompleted, latestRedeemedReward]);

  const isClaimRedeemed = useMemo(() => {
    if (!activeClaim) return false;
    const currentVisits = loyaltyData?.cycle?.visitCount || 0;
    if (currentVisits >= activeClaim.expectedVisitNumber) return true;
    return Boolean(
      loyaltyData?.redeemedRewards?.some(
        (r) => r.milestoneId === activeClaim.reward.id && r.isCurrentCycle
      )
    );
  }, [activeClaim, loyaltyData]);

  const progressPercent = Math.min(100, Math.round((Math.min(visitCount, cycleLength) / cycleLength) * 100));

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
            onClick={() => refetchPublicData()}
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
        {/* ── Global Alerts with AAO Moments ─────────────────────────────── */}
        {loyaltyData?.pendingRequest && (
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-[#FFD444]/60 text-[#172033] text-sm flex items-center gap-3 shadow-xs">
            <AaoMascot mood="hello" size={38} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-[#172033]">Almost there!</p>
              <p className="text-xs text-[#667085] mt-0.5">Your visit is waiting for staff approval.</p>
            </div>
          </div>
        )}
        {approvedAlert && (
          <div className="p-3.5 rounded-2xl bg-[#EAFBEF] border border-[#55E07E]/40 text-[#172033] text-sm flex items-center gap-3 shadow-xs">
            <AaoMascot mood="stamp" size={38} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-[#172033]">Nice! You got a stamp!</p>
              <p className="text-xs text-[#0E7A36] mt-0.5">Your loyalty card just moved one step closer to your reward.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 shadow-xs">
            <AaoMascot mood="oops" size={34} className="shrink-0" />
            <span className="text-xs font-medium">{error}</span>
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
          {isAuthenticated && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-xs text-[#667085]">
                {customerName ? (
                  <>
                    Welcome back, <span className="font-bold text-[#172033]">{customerName}</span>!
                  </>
                ) : (
                  <span className="font-medium text-[#667085]">Welcome back!</span>
                )}
              </p>
            </div>
          )}

          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Top line: program name + visits */}
            <div>
              <p className="text-xs font-medium text-[#667085] mb-0.5">
                {publicData?.program.name || loyaltyData?.program.name || 'Loyalty Program'}
              </p>
              <h2 className="text-2xl font-extrabold text-[#172033] tracking-tight leading-none">
                {`${Math.min(visitCount, cycleLength)} of ${cycleLength} visits`}
              </h2>
              <p className="text-xs text-[#667085] mt-1">
                {isRewardRedeemed
                  ? 'Reward Redeemed'
                  : isNewVirtualCycle
                  ? 'Your next loyalty cycle starts here.'
                  : visitCount === 0
                  ? 'Your first reward starts with your first visit.'
                  : `${visitCount} qualifying visit${visitCount !== 1 ? 's' : ''} completed`}
              </p>
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
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-[#0E7A36] font-bold">Reward Ready</span>
                  <span className="truncate max-w-[180px] text-[#172033] font-bold">
                    {rewardLabel(activeUnlockedReward)}
                  </span>
                </div>
              ) : isRewardRedeemed ? (
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-[#0E7A36] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Reward Redeemed</span>
                  </span>
                  <span className="truncate max-w-[180px] text-[#667085]">
                    {latestRedeemedReward ? rewardLabel(latestRedeemedReward) : 'Completed'}
                  </span>
                </div>
              ) : nextMilestone && !isCycleCompleted ? (
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#667085] leading-normal">
                  <span className="truncate">
                    {Math.max(1, nextMilestone.visitNumber - visitCount)} visit{Math.max(1, nextMilestone.visitNumber - visitCount) !== 1 ? 's' : ''} until next reward
                    <span className="text-[#98A2B3] mx-1">—</span>
                    <span className="font-semibold text-[#172033]">
                      {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-[#667085] shrink-0 ml-2">
                    {Math.max(1, nextMilestone.visitNumber - visitCount)} to go
                  </span>
                </div>
              ) : isCycleCompleted ? (
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#0E7A36] font-bold">
                  <span>Cycle completed!</span>
                  <span>All rewards unlocked</span>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#667085]">
                  <span>{cycleLength} qualifying visits in cycle</span>
                </div>
              )}
            </div>

            {/* ── Stamp punch grid (EXACTLY cycleLength visual slots) ──────────────── */}
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-3.5">
              <div
                className={`grid gap-2 ${
                  cycleLength <= 4
                    ? 'grid-cols-4'
                    : cycleLength === 5
                    ? 'grid-cols-5'
                    : cycleLength <= 8
                    ? 'grid-cols-4'
                    : 'grid-cols-5'
                }`}
              >
                {Array.from({ length: cycleLength }, (_, i) => {
                  const slotNum = i + 1;
                  const isCompleted = !isNewVirtualCycle && slotNum <= visitCount;
                  const programMilestones = loyaltyData?.milestones || publicData?.program?.milestones || [];
                  const milestone = programMilestones.find(
                    (m: any) => m.visitNumber === slotNum
                  );
                  const hasReward = Boolean(
                    milestone &&
                    milestone.rewardType &&
                    milestone.rewardType !== 'NONE'
                  );
                  const rewardLabelText = milestone ? getSlotRewardLabel(milestone) : '';
                  const mAny = milestone as any;
                  const isRedeemed = !isNewVirtualCycle && (mAny?.status === 'REDEEMED' || (mAny?.id ? redeemedRewards.some((r) => r.milestoneId === mAny.id && r.isCurrentCycle) : false));
                  const isUnlocked = !isNewVirtualCycle && (mAny?.status === 'UNLOCKED' || (!isRedeemed && (isCompleted || (mAny?.id ? unlockedRewards.some((r) => r.milestoneId === mAny.id && r.isCurrentCycle) : false))));

                  // Case A: Normal visit slot (NONE milestone or no reward)
                  if (!hasReward) {
                    if (isCompleted) {
                      return (
                        <div
                          key={slotNum}
                          title={`Visit ${slotNum} completed`}
                          className="aspect-square rounded-xl bg-[#EAFBEF] border-2 border-[#55E07E] flex items-center justify-center shadow-xs transition-all"
                        >
                          <Check className="w-5 h-5 text-[#0E7A36] stroke-[3]" />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={slotNum}
                        title={`Visit ${slotNum}`}
                        className="aspect-square rounded-xl bg-white border-2 border-dashed border-slate-200 text-[#667085] flex items-center justify-center transition-all"
                      >
                        <span className="text-sm font-bold text-[#667085]">{slotNum}</span>
                      </div>
                    );
                  }

                  // Case B: Reward milestone slot
                  if (isRedeemed) {
                    // Redeemed milestone reward: completed checkmark
                    return (
                      <div
                        key={slotNum}
                        title={`Visit ${slotNum}: ${rewardLabelText} (Redeemed)`}
                        className="aspect-square rounded-xl bg-[#EAFBEF] border-2 border-[#55E07E] flex items-center justify-center shadow-xs transition-all"
                      >
                        <Check className="w-5 h-5 text-[#0E7A36] stroke-[3]" />
                      </div>
                    );
                  }

                  if (isUnlocked || isCompleted) {
                    // Reached / Unlocked milestone reward: 🎁 with subtle green/reward treatment
                    return (
                      <div
                        key={slotNum}
                        title={`Visit ${slotNum}: ${rewardLabelText} (Reward Ready)`}
                        className="aspect-square rounded-xl bg-[#EAFBEF] border-2 border-[#55E07E] flex items-center justify-center shadow-xs transition-all"
                      >
                        <Gift className="w-5 h-5 text-[#0E7A36]" />
                      </div>
                    );
                  }

                  // Locked future reward milestone: 🎁 subtle yellow/gold treatment
                  return (
                    <div
                      key={slotNum}
                      title={`Visit ${slotNum}: ${rewardLabelText}`}
                      className="aspect-square rounded-xl bg-[#FFFDF5] border-2 border-dashed border-[#FFD444]/80 flex items-center justify-center transition-all shadow-xs"
                    >
                      <Gift className="w-5 h-5 text-[#D97706]" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Action Section: Show Reward OR Redeemed State OR Stamp Pending OR Request Stamp ───────────── */}
            {isAuthenticated && (
              <div>
                {activeUnlockedReward ? (
                  /* State D: Reward Ready */
                  <div className="rounded-2xl border border-[#55E07E]/40 bg-[#EAFBEF] p-4 space-y-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <AaoMascot mood="reward" size={48} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-[#172033] leading-tight">
                          You did it!
                        </h3>
                        <p className="text-sm font-bold text-[#0E7A36] mt-0.5 truncate">
                          Your {rewardLabel(activeUnlockedReward)} is ready.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedRewardForQr(activeUnlockedReward)}
                      className="w-full py-3 px-4 bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <QrCode className="w-4 h-4 stroke-[2.5]" />
                      <span>Show Reward &rarr;</span>
                    </button>
                  </div>
                ) : isRewardRedeemed && latestRedeemedReward ? (
                  /* State E: Reward Redeemed - Emotional Payoff */
                  <div className="rounded-2xl border border-[#55E07E]/50 bg-[#EAFBEF] p-4.5 flex items-center gap-3.5 shadow-xs">
                    <AaoMascot mood="celebrate" size={52} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#55E07E]/50 text-[#0E7A36] text-[10px] font-black uppercase tracking-wider mb-1 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-[#0E7A36]" />
                        <span>You did it!</span>
                      </div>
                      <h3 className="text-sm font-black text-[#172033] leading-snug">
                        Your {latestRedeemedReward.rewardName || latestRedeemedReward.rewardType?.replace(/_/g, ' ') || 'reward'} has been redeemed.
                      </h3>
                      <p className="text-xs font-bold text-[#0E7A36] mt-1">
                        See you again!
                      </p>
                    </div>
                  </div>
                ) : loyaltyData?.pendingRequest ? (
                  /* State B: Stamp Requested / Pending - Compact approval state */
                  <div className="w-full py-3.5 px-4 bg-[#F8FAFC] border border-dashed border-[#E5E7EB] rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-[#667085]">
                    <Loader2 className="w-4 h-4 text-[#FFD444] animate-spin shrink-0" />
                    <span>Waiting for staff approval...</span>
                  </div>
                ) : (
                  /* State A: Request a Stamp OR Complete Final Visit */
                  <div className="space-y-2.5">
                    {isNextVisitReward && (
                      <div className="rounded-2xl bg-[#FFFDF5] border border-[#FFD444]/70 p-3.5 flex items-center gap-3 shadow-xs">
                        <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#FFD444] flex items-center justify-center shrink-0 text-[#D97706]">
                          <Gift className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-black uppercase text-[#B45309] tracking-wider block">
                            ALMOST THERE!
                          </span>
                          <p className="text-xs font-bold text-[#172033] leading-snug">
                            One more visit and your {nextVisitRewardName} is yours.
                          </p>
                        </div>
                      </div>
                    )}

                    {isNextVisitReward ? (
                      <button
                        onClick={handleClaimRewardVisit}
                        disabled={isClaimingReward}
                        className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] rounded-xl text-sm font-black transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
                      >
                        {isClaimingReward ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#172033]" />
                            <span>Generating QR…</span>
                          </>
                        ) : (
                          <span>Complete Final Visit &rarr;</span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleRequestStamp}
                        disabled={isRequestingVisit}
                        className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] rounded-xl text-sm font-black transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.98]"
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
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ─── NEXT REWARD CARD (Hidden when next visit is already the reward milestone) ─── */}
        {nextMilestone && !isNextVisitReward && !activeUnlockedReward && !isCycleCompleted && !isRewardRedeemed && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl py-3.5 px-4 sm:p-4.5 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-[#E5E7EB] text-[#FFD444] flex items-center justify-center shrink-0">
                <Star className="w-4.5 h-4.5 fill-[#FFD444]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#667085]">
                  {Math.max(1, nextMilestone.visitNumber - visitCount)} visit{Math.max(1, nextMilestone.visitNumber - visitCount) !== 1 ? 's' : ''} until next reward
                </p>
                <p className="text-sm font-bold text-[#172033] truncate">
                  {(nextMilestone as any).rewardName || (nextMilestone as any).rewardType?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-extrabold text-[#172033] leading-none">
                  {Math.max(1, nextMilestone.visitNumber - visitCount)}
                </p>
                <p className="text-[10px] text-[#667085] font-medium">to go</p>
              </div>
            </div>
            {(nextMilestone as any).rewardDescription && (
              <p className="text-xs text-[#667085] mt-1.5 ml-12">
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
                        {reward.unlockedAt && (
                          <span className="text-[11px] text-[#667085]">
                            Earned {formatDate(reward.unlockedAt)}
                          </span>
                        )}
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

        {/* ─── MILESTONES TIMELINE (Collapsible) ───────────────────────────── */}
        {(loyaltyData?.milestones || publicData?.program.milestones) && (
          <section
            className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs"
          >
            <button
              type="button"
              onClick={() => setShowMilestones(!showMilestones)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-[#172033] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#667085]" />
                <span>Milestones</span>
              </span>
              {showMilestones ? (
                <ChevronUp className="w-4 h-4 text-[#667085]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#667085]" />
              )}
            </button>

            {showMilestones && (
              <div className="px-5 pb-4 pt-1">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

                  <div className="space-y-0">
                    {(loyaltyData?.milestones || publicData?.program.milestones || []).map(
                      (m: any, idx: number) => {
                        const isReached = !isNewVirtualCycle && visitCount >= m.visitNumber;
                        const isReward = m.rewardType && m.rewardType !== 'NONE';
                        const isRedeemed = !isNewVirtualCycle && (m.status === 'REDEEMED' || (m.id ? redeemedRewards.some((r) => r.milestoneId === m.id && r.isCurrentCycle) : false));
                        const isUnlocked = !isNewVirtualCycle && (m.status === 'UNLOCKED' || (!isRedeemed && (isReached || (m.id ? unlockedRewards.some((r) => r.milestoneId === m.id && r.isCurrentCycle) : false))));

                        return (
                          <div key={m.id || idx} className="relative flex items-start gap-3 py-2.5">
                            {/* Circle indicator */}
                            <div
                              className={`relative z-10 w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isRedeemed
                                  ? 'bg-slate-100 border-slate-300 text-[#667085]'
                                  : isUnlocked
                                  ? 'bg-[#EAFBEF] border-2 border-[#55E07E] text-[#0E7A36]'
                                  : isReward
                                  ? 'bg-[#FFFDF5] border-2 border-dashed border-[#FFD444]/80 text-[#D97706]'
                                  : isReached
                                  ? 'bg-[#EAFBEF] border-2 border-[#55E07E] text-[#0E7A36]'
                                  : 'bg-white border-slate-200 text-[#667085]'
                              }`}
                            >
                              {isRedeemed ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : isReward ? (
                                <Gift className={`w-3.5 h-3.5 ${isUnlocked ? 'text-[#0E7A36]' : 'text-[#D97706]'}`} />
                              ) : isReached ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <span className="text-[11px] font-bold text-[#667085]">{m.visitNumber}</span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-1">
                              <p
                                className={`text-sm font-bold truncate ${
                                  isRedeemed
                                    ? 'text-[#667085] line-through'
                                    : isUnlocked || isReward
                                    ? 'text-[#172033]'
                                    : 'text-[#667085]'
                                }`}
                              >
                                {isReward ? (
                                  <>
                                    <span>{m.rewardName || m.rewardType.replace(/_/g, ' ')}</span>
                                    <span className="text-[#667085] font-normal"> &mdash; </span>
                                    <span
                                      className={
                                        isRedeemed
                                          ? 'text-[#667085]'
                                          : isUnlocked
                                          ? 'text-[#0E7A36]'
                                          : 'text-[#667085]'
                                      }
                                    >
                                      {isRedeemed ? 'REDEEMED' : isUnlocked ? 'READY' : 'LOCKED'}
                                    </span>
                                  </>
                                ) : (
                                  `Visit ${m.visitNumber}`
                                )}
                              </p>
                              <p className="text-xs text-[#667085] mt-0.5">
                                After {m.visitNumber} qualifying visit{m.visitNumber !== 1 ? 's' : ''}
                              </p>
                              {isReward && (
                                <p className="text-xs text-[#172033] font-medium mt-0.5 truncate">
                                  {getMilestoneRewardDetail(m)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}
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
                          Stamp #{visit.visitNumberInCycle || 1}
                          <span className="text-[#667085] text-xs ml-1.5">· {formatDate(visit.createdAt)}</span>
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

          <div className="text-center flex items-center justify-center gap-1.5 py-1">
            <span className="text-xs text-[#667085]">Powered by</span>
            <AaoLogo variant="full" size="xs" className="h-4.5 w-auto inline-block" />
            <span className="text-xs text-[#667085]">• Scan. Earn. Come Again.</span>
          </div>
        </footer>
      </div>

      {/* Reward QR Code Modal (for existing unlocked rewards) */}
      <RewardQrModal
        reward={selectedRewardForQr}
        businessName={loyaltyData?.business.name || publicData?.business.name}
        onClose={() => setSelectedRewardForQr(null)}
      />

      {/* Claim Reward QR Code Modal (for Claim Reward Visit flow) */}
      <ClaimRewardQrModal
        claim={activeClaim}
        isRedeemed={isClaimRedeemed}
        onClose={() => {
          setActiveClaim(null);
        }}
      />
    </div>
  );
};
