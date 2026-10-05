import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import type {
  CustomerHistoryItem,
  CustomerRewardItem,
  RewardClaimData,
} from '../../services/customerService';
import { RewardQrModal } from '../../components/customer/RewardQrModal';
import { ClaimRewardQrModal } from '../../components/customer/ClaimRewardQrModal';
import { AaoMascot } from '../../components/ui/AaoBrand';
import {
  Gift,
  CheckCircle2,
  Calendar,
  Store,
  QrCode,
  Loader2,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface UnlockedRewardItem {
  type: 'UNLOCKED';
  id: string;
  businessName: string;
  rewardType: string;
  rewardName?: string | null;
  rewardValue?: string | null;
  status: 'UNLOCKED';
  unlockedAt: string;
  redemptionToken?: string | null;
  cycleNumber: number;
}

interface RewardVisitOpportunityItem {
  type: 'REWARD_VISIT';
  id: string;
  businessId: string;
  businessName: string;
  qrToken: string;
  rewardName: string;
  rewardType: string;
  rewardValue?: string | null;
  visitNumber: number;
  cycleLength: number;
  cycleNumber: number;
  isFinalVisit: boolean;
}

interface RedeemedRewardItem {
  id: string;
  businessName: string;
  rewardType: string;
  rewardName?: string | null;
  rewardValue?: string | null;
  status: 'REDEEMED';
  unlockedAt: string;
  redeemedAt?: string | null;
  redemptionToken?: string | null;
  cycleNumber: number;
}

type AvailableItem = UnlockedRewardItem | RewardVisitOpportunityItem;

export const CustomerRewards: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'AVAILABLE' | 'REDEEMED'>('AVAILABLE');
  const [history, setHistory] = useState<CustomerHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected reward for standard presentation modal
  const [selectedReward, setSelectedReward] = useState<CustomerRewardItem | null>(null);
  const [selectedRewardBusinessName, setSelectedRewardBusinessName] = useState<string>('');

  // Active RewardClaim state for "Complete Final Visit" flow
  const [activeClaim, setActiveClaim] = useState<RewardClaimData | null>(null);
  const [isClaimRedeemed, setIsClaimRedeemed] = useState<boolean>(false);
  const [isClaimingReward, setIsClaimingReward] = useState<boolean>(false);
  const [claimingError, setClaimingError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const res: CustomerHistoryItem[] = await customerService.getCustomerHistory();
      setHistory(res);
    } catch (err: any) {
      console.error('Failed to load customer rewards data:', err);
      setError('Unable to load your rewards. Please tap to retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive Unlocked Rewards, Reward Visit Opportunities, and Redeemed Rewards
  const { availableItems, redeemedRewards } = useMemo(() => {
    const unlocked: UnlockedRewardItem[] = [];
    const opportunities: RewardVisitOpportunityItem[] = [];
    const redeemed: RedeemedRewardItem[] = [];

    for (const b of history) {
      // 1. Process all cycle rewards
      for (const cycle of b.cycles) {
        for (const rew of cycle.rewards) {
          if (rew.status === 'UNLOCKED') {
            unlocked.push({
              type: 'UNLOCKED',
              id: rew.id,
              businessName: b.business.name,
              rewardType: rew.rewardType,
              rewardName: rew.rewardName,
              rewardValue: rew.rewardValue,
              status: 'UNLOCKED',
              unlockedAt: rew.unlockedAt,
              redemptionToken: rew.redemptionToken,
              cycleNumber: cycle.cycleNumber,
            });
          } else if (rew.status === 'REDEEMED') {
            redeemed.push({
              id: rew.id,
              businessName: b.business.name,
              rewardType: rew.rewardType,
              rewardName: rew.rewardName,
              rewardValue: rew.rewardValue,
              status: 'REDEEMED',
              unlockedAt: rew.unlockedAt,
              redeemedAt: rew.redeemedAt,
              redemptionToken: rew.redemptionToken,
              cycleNumber: cycle.cycleNumber,
            });
          }
        }
      }

      // 2. Identify Actionable Reward Visit Opportunities
      // Check active cycle or latest state
      const activeCycle = b.cycles.find((c) => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS');
      const latestCycle = b.cycles[0];

      // If there is an active unlocked reward for this business, it is already waiting in "unlocked"
      const hasActiveUnlocked = activeCycle
        ? activeCycle.rewards.some((r) => r.status === 'UNLOCKED')
        : latestCycle?.rewards.some((r) => r.status === 'UNLOCKED');

      if (!hasActiveUnlocked) {
        const visitCount = activeCycle ? activeCycle.visitCount : 0;
        const cycleLength = activeCycle
          ? activeCycle.cycleLength
          : b.business.branches?.[0]?.program?.cycleLength || 4;

        const milestones =
          activeCycle?.milestones && activeCycle.milestones.length > 0
            ? activeCycle.milestones
            : b.business.branches?.[0]?.program?.milestones || [];

        const nextVisitNumber = visitCount + 1;
        const nextMilestone = milestones.find((m) => m.visitNumber === nextVisitNumber);

        const isNextVisitReward = Boolean(
          nextMilestone &&
            nextMilestone.rewardType &&
            nextMilestone.rewardType !== 'NONE'
        );

        const qrToken =
          activeCycle?.qrToken ||
          latestCycle?.qrToken ||
          b.business.branches?.[0]?.qrToken ||
          null;

        if (isNextVisitReward && nextMilestone && qrToken) {
          const rawName =
            nextMilestone.rewardName ||
            nextMilestone.rewardType.replace(/_/g, ' ') ||
            'Reward';
          const isFree =
            nextMilestone.rewardType === 'FREE_ITEM' ||
            nextMilestone.rewardType === 'FREE_SERVICE' ||
            nextMilestone.rewardType === 'FREE_PRODUCT';
          const rewardName =
            isFree && !rawName.toLowerCase().startsWith('free')
              ? `Free ${rawName}`
              : rawName;

          opportunities.push({
            type: 'REWARD_VISIT',
            id: `opp-${b.business.id}-${nextMilestone.id || nextVisitNumber}`,
            businessId: b.business.id,
            businessName: b.business.name,
            qrToken,
            rewardName,
            rewardType: nextMilestone.rewardType,
            rewardValue: nextMilestone.rewardValue,
            visitNumber: nextVisitNumber,
            cycleLength,
            cycleNumber: activeCycle ? activeCycle.cycleNumber : (latestCycle ? latestCycle.cycleNumber + 1 : 1),
            isFinalVisit: nextVisitNumber === cycleLength,
          });
        }
      }
    }

    // Sort unlocked by date desc
    unlocked.sort(
      (a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    );

    // Sort redeemed by redeemedAt desc
    redeemed.sort((a, b) => {
      const timeA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : new Date(a.unlockedAt).getTime();
      const timeB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : new Date(b.unlockedAt).getTime();
      return timeB - timeA;
    });

    const combinedAvailable: AvailableItem[] = [...unlocked, ...opportunities];

    return {
      availableItems: combinedAvailable,
      redeemedRewards: redeemed,
    };
  }, [history]);

  // Handle Complete Final Visit (RewardClaim flow)
  const handleStartRewardClaim = async (qrToken: string) => {
    setIsClaimingReward(true);
    setClaimingError(null);
    try {
      const claimData = await customerService.createRewardClaim(qrToken);
      setActiveClaim(claimData);
      setIsClaimRedeemed(false);
    } catch (err: any) {
      setClaimingError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to generate reward claim token. Please try again.'
      );
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Poll while activeClaim is open to detect staff approval/redemption
  useEffect(() => {
    if (!activeClaim || isClaimRedeemed) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await customerService.getCustomerHistory();
        setHistory(res);

        // Check if any cycle in history has a redeemed reward matching this claim
        let foundRedeemed = false;
        for (const b of res) {
          for (const c of b.cycles) {
            for (const r of c.rewards) {
              if (
                r.status === 'REDEEMED' &&
                (r.rewardName === activeClaim.reward.name ||
                  r.rewardType === activeClaim.reward.type)
              ) {
                foundRedeemed = true;
                break;
              }
            }
          }
        }

        if (foundRedeemed) {
          setIsClaimRedeemed(true);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeClaim, isClaimRedeemed]);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD444]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#172033]">
            My Rewards
          </span>
        </div>
        <h1 className="text-xl font-black tracking-tight text-[#172033]">
          Your earned rewards, all in one place.
        </h1>
      </div>

      {/* 2-Option Segmented Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setTab('AVAILABLE')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tab === 'AVAILABLE'
              ? 'bg-[#FFFFFF] text-[#172033] shadow-xs'
              : 'text-[#667085] hover:text-[#172033]'
          }`}
        >
          <span>Available</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              tab === 'AVAILABLE'
                ? 'bg-[#FFD444] text-[#172033]'
                : 'bg-slate-300 text-[#667085]'
            }`}
          >
            {availableItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('REDEEMED')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tab === 'REDEEMED'
              ? 'bg-[#FFFFFF] text-[#172033] shadow-xs'
              : 'text-[#667085] hover:text-[#172033]'
          }`}
        >
          <span>Redeemed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
              tab === 'REDEEMED'
                ? 'bg-[#FFD444] text-[#172033]'
                : 'bg-slate-300 text-[#667085]'
            }`}
          >
            {redeemedRewards.length}
          </span>
        </button>
      </div>

      {/* Claiming Error Toast/Banner */}
      {claimingError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{claimingError}</span>
          <button
            onClick={() => setClaimingError(null)}
            className="text-xs font-bold text-rose-700 underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-[#667085] gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#FFD444]" />
          <span className="text-xs font-medium">Loading your rewards...</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadData}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* List content */}
      {!isLoading && (
        <div className="space-y-3 pt-1">
          {tab === 'AVAILABLE' ? (
            availableItems.length > 0 ? (
              availableItems.map((item) => {
                if (item.type === 'UNLOCKED') {
                  const name = item.rewardName || item.rewardType.replace(/_/g, ' ');
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedReward({
                          id: item.id,
                          rewardType: item.rewardType,
                          rewardName: item.rewardName,
                          rewardValue: item.rewardValue,
                          unlockedAt: item.unlockedAt,
                          cycleNumber: item.cycleNumber,
                          status: 'UNLOCKED',
                          redemptionToken: item.redemptionToken,
                        });
                        setSelectedRewardBusinessName(item.businessName);
                      }}
                      role="button"
                      tabIndex={0}
                      className="w-full text-left rounded-2xl border bg-[#FFFFFF] border-[#E5E7EB] shadow-xs hover:border-[#FFD444] hover:shadow-sm transition-all overflow-hidden cursor-pointer select-none active:scale-[0.99] p-4"
                    >
                      {/* Top status bar */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-[#667085] flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-[#667085]" />
                          <span>{item.businessName}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAFBEF] text-[#0E7A36] font-extrabold text-[10px] border border-[#55E07E]/30">
                          <Gift className="w-3 h-3 text-[#16A34A]" />
                          <span>YOUR REWARD IS READY!</span>
                        </span>
                      </div>

                      {/* Reward Title & Value */}
                      <div className="flex items-start justify-between gap-3 my-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-base text-[#172033] leading-snug truncate">
                            {name}
                          </h3>
                          {item.rewardValue && (
                            <p className="text-xs text-[#0E7A36] font-bold mt-0.5">
                              Value: {item.rewardValue}
                            </p>
                          )}
                          <p className="text-[11px] text-[#667085] mt-1">
                            Cycle {item.cycleNumber} Reward
                          </p>
                        </div>

                        <div className="w-11 h-11 rounded-xl bg-[#EAFBEF] text-[#16A34A] border border-[#55E07E]/30 shadow-xs flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-[#16A34A]" />
                        </div>
                      </div>

                      {/* Bottom action bar */}
                      <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                        <div className="text-[11px] text-[#667085] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#667085]" />
                          <span>
                            Unlocked on{' '}
                            {new Date(item.unlockedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <span className="px-3.5 py-1.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-xs shadow-xs transition-colors flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Show Reward</span>
                        </span>
                      </div>
                    </div>
                  );
                }

                // REWARD_VISIT Opportunity Item
                return (
                  <div
                    key={item.id}
                    className="w-full text-left rounded-2xl border-2 border-[#FFD444] bg-[#FFFDF5] shadow-xs p-4 space-y-3 transition-all"
                  >
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#667085] flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#667085]" />
                        <span>{item.businessName}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFD444]/30 text-[#D97706] font-extrabold text-[10px] border border-[#FFD444]">
                        <Sparkles className="w-3 h-3 text-[#D97706]" />
                        <span>REWARD VISIT READY</span>
                      </span>
                    </div>

                    {/* Reward Title & Context */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">🎁</span>
                          <h3 className="font-black text-base text-[#172033] leading-snug">
                            {item.rewardName}
                          </h3>
                        </div>
                        <p className="text-xs text-[#667085]">
                          {item.isFinalVisit
                            ? 'Complete your final visit to unlock your reward.'
                            : `Complete visit ${item.visitNumber} to unlock your reward.`}
                        </p>
                      </div>

                      <div className="w-11 h-11 rounded-xl bg-[#FFD444]/25 text-[#D97706] border border-[#FFD444]/50 shadow-2xs flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5 text-[#D97706]" />
                      </div>
                    </div>

                    {/* Action Button: Complete Final Visit */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleStartRewardClaim(item.qrToken)}
                        disabled={isClaimingReward}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isClaimingReward ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating Claim Token...</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {item.isFinalVisit
                                ? 'Complete Final Visit'
                                : `Complete Visit ${item.visitNumber}`}
                            </span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty Available State */
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-3 shadow-xs">
                <AaoMascot mood="hello" size={74} className="mx-auto" />
                <div>
                  <h4 className="text-sm font-black text-[#172033]">
                    No rewards yet
                  </h4>
                  <p className="text-xs text-[#667085] max-w-xs mx-auto mt-1 leading-relaxed">
                    Complete visits at your favorite local spots to unlock rewards.
                  </p>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/explore')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <span>Explore Businesses</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Redeemed Tab */
            redeemedRewards.length > 0 ? (
              redeemedRewards.map((reward) => {
                const name = reward.rewardName || reward.rewardType.replace(/_/g, ' ');
                return (
                  <div
                    key={reward.id}
                    onClick={() => {
                      setSelectedReward({
                        id: reward.id,
                        rewardType: reward.rewardType,
                        rewardName: reward.rewardName,
                        rewardValue: reward.rewardValue,
                        unlockedAt: reward.unlockedAt,
                        redeemedAt: reward.redeemedAt,
                        cycleNumber: reward.cycleNumber,
                        status: 'REDEEMED',
                        redemptionToken: reward.redemptionToken,
                      });
                      setSelectedRewardBusinessName(reward.businessName);
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-full text-left rounded-2xl border bg-[#FFFFFF] border-[#E5E7EB] shadow-xs hover:border-[#55E07E] hover:shadow-sm transition-all overflow-hidden cursor-pointer select-none active:scale-[0.99] p-4"
                  >
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[#667085] flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#667085]" />
                        <span>{reward.businessName}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAFBEF] text-[#0E7A36] font-black text-[10px] border border-[#55E07E]/30 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>REDEEMED</span>
                      </span>
                    </div>

                    {/* Reward Title & Value */}
                    <div className="flex items-start justify-between gap-3 my-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base text-[#172033] leading-snug truncate">
                          {name}
                        </h3>
                        {reward.rewardValue && (
                          <p className="text-xs text-[#0E7A36] font-bold mt-0.5">
                            Value: {reward.rewardValue}
                          </p>
                        )}
                        <p className="text-[11px] font-semibold text-[#667085] mt-1">
                          Cycle {reward.cycleNumber} Reward
                        </p>
                      </div>

                      <div className="w-11 h-11 rounded-xl bg-[#EAFBEF] text-[#16A34A] border border-[#55E07E]/30 shadow-2xs flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                      </div>
                    </div>

                    {/* Bottom info */}
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                      <div className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#667085]" />
                        <span>
                          Redeemed on{' '}
                          {reward.redeemedAt
                            ? new Date(reward.redeemedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Past visit'}
                        </span>
                      </div>

                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#172033] font-bold text-xs transition-colors flex items-center gap-1">
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty Redeemed State */
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-3 shadow-xs">
                <AaoMascot mood="celebrate" size={74} className="mx-auto" />
                <div>
                  <h4 className="text-sm font-black text-[#172033]">
                    No redeemed rewards yet
                  </h4>
                  <p className="text-xs text-[#667085] max-w-xs mx-auto mt-1 leading-relaxed">
                    Your past redeemed rewards will appear here.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Unified Reward Detail / Presentation Modal (For already unlocked rewards) */}
      <RewardQrModal
        reward={selectedReward}
        businessName={selectedRewardBusinessName}
        onClose={() => {
          setSelectedReward(null);
          setSelectedRewardBusinessName('');
        }}
      />

      {/* Claim Reward QR Code Modal (For actionable Reward Visit opportunities) */}
      <ClaimRewardQrModal
        claim={activeClaim}
        isRedeemed={isClaimRedeemed}
        onClose={() => {
          setActiveClaim(null);
          setIsClaimRedeemed(false);
          loadData();
        }}
      />
    </div>
  );
};
