import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import type { CustomerHistoryItem } from '../../services/customerService';
import { AaoMascot } from '../../components/ui/AaoBrand';
import {
  QrCode,
  ArrowRight,
  Store,
  ChevronRight,
  Compass,
  Check,
  Gift,
  Loader2,
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [history, setHistory] = useState<CustomerHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const res = await customerService.getCustomerHistory();
      setHistory(res);
    } catch (err: any) {
      console.error('Failed to load customer history:', err);
      setError('Unable to load your loyalty cards. Tap to retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Greeting helper based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Extract primary loyalty card for each business (active cycle or latest completed cycle)
  // Extract primary loyalty card for each business (active cycle, or latest completed cycle waiting for reward, or fresh virtual next cycle)
  const activeCards = history.flatMap((b) => {
    const activeCycle = b.cycles.find((c) => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS');
    const latestCycle = b.cycles[0];

    if (!activeCycle && !latestCycle) return [];

    // Check if latestCycle has an UNLOCKED reward waiting to be redeemed
    const latestUnlockedReward =
      latestCycle?.rewards.find((r) => r.status === 'UNLOCKED') || null;

    let displayCycle;
    let unlockedReward: any = null;

    if (activeCycle) {
      displayCycle = activeCycle;
      unlockedReward = activeCycle.rewards.find((r) => r.status === 'UNLOCKED') || null;
    } else if (latestUnlockedReward && latestCycle) {
      // Completed cycle, but customer has unlocked reward waiting to be redeemed
      displayCycle = latestCycle;
      unlockedReward = latestUnlockedReward;
    } else if (latestCycle) {
      // Completed cycle where rewards were redeemed -> Ready for next cycle (0 of N visits)
      displayCycle = {
        ...latestCycle,
        id: `virtual-${latestCycle.cycleNumber + 1}`,
        cycleNumber: latestCycle.cycleNumber + 1,
        visitCount: 0,
        status: 'ACTIVE',
        rewards: [],
      };
      unlockedReward = null;
    } else {
      return [];
    }

    return [
      {
        businessId: b.business.id,
        businessName: b.business.name,
        businessType: b.business.type,
        qrToken: displayCycle.qrToken || latestCycle?.qrToken || b.business.branches?.[0]?.qrToken || null,
        branchName:
          b.business.branches?.[0]?.name ||
          latestCycle?.visits[0]?.branchName ||
          'Main Branch',
        cycle: displayCycle,
        unlockedReward,
      },
    ];
  });

  // Extract all recent visits across all businesses (latest 3)
  const recentVisits = history
    .flatMap((b) =>
      b.cycles.flatMap((c) =>
        c.visits.map((v) => ({
          id: v.id,
          businessName: b.business.name,
          branchName: v.branchName,
          visitNumber: v.visitNumberInCycle,
          cycleLength: c.cycleLength,
          createdAt: v.createdAt,
          qrToken: c.qrToken || b.business.branches?.[0]?.qrToken || null,
        }))
      )
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Calculate unlocked rewards count
  const unlockedRewardsCount = history.reduce((acc, b) => {
    return (
      acc +
      b.cycles.reduce(
        (cAcc, c) =>
          cAcc + c.rewards.filter((r) => r.status === 'UNLOCKED').length,
        0
      )
    );
  }, 0);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* 1. Welcoming Hero Card - Natural, Warm & Compact */}
      <section className="bg-white rounded-2xl p-4 sm:p-4.5 border border-[#E5E7EB] shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
        <div className="space-y-1 z-10 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFD444]/20 text-[#172033] text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444]" />
            <span>Scan • Earn • Come Again</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#172033] leading-tight">
            {getGreeting()}!
          </h1>

          <p className="text-xs text-[#667085] font-medium">
            Ready for your next reward?
          </p>
        </div>

        {/* AAO Mascot Hello Moment */}
        <div className="shrink-0 -mr-1">
          <AaoMascot mood="hello" size={76} className="hover:scale-105 transition-transform" />
        </div>
      </section>

      {/* 2. Unlocked Reward Banner (Primary notification when reward is available) */}
      {unlockedRewardsCount > 0 && (
        <section
          onClick={() => navigate('/customer/rewards')}
          className="bg-[#EAFBEF] border-2 border-[#55E07E]/50 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:border-[#55E07E] transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#55E07E]/40 flex items-center justify-center shrink-0">
              <AaoMascot mood="reward" size={36} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-black text-[#16A34A] tracking-wider block">
                REWARD READY!
              </span>
              <p className="text-xs font-bold text-[#172033] leading-snug break-words">
                You did it! Your reward is ready.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="shrink-0 px-3 py-1.5 rounded-xl bg-[#55E07E] group-hover:bg-[#43D46E] text-[#172033] text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
          >
            <span>View</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </section>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-[#667085] gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#FFD444]" />
          <span className="text-xs font-medium">Checking your stamps...</span>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AaoMascot mood="oops" size={36} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Priority Content: Your Loyalty Passes (Moved above Scan CTA) */}
      {!isLoading && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
              Your Loyalty Passes ({activeCards.length})
            </h2>
            <button
              onClick={() => navigate('/customer/explore')}
              className="text-xs font-bold text-[#172033] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Explore places</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
            </button>
          </div>

          {activeCards.length > 0 ? (
            <div className="space-y-3">
              {activeCards.map(
                ({
                  businessId,
                  businessName,
                  qrToken,
                  branchName,
                  cycle,
                  unlockedReward,
                }) => {
                  const cycleLength = cycle.cycleLength;
                  const visitCount = Math.min(cycleLength, cycle.visitCount);
                  const progressText = `${visitCount} of ${cycleLength} visits`;

                  // Extract actual primary reward name
                  const targetRewardName =
                    unlockedReward?.rewardName ||
                    cycle.rewards?.[0]?.rewardName ||
                    'Reward';

                  return (
                    <div
                      key={`${businessId}-${cycle.id}`}
                      onClick={() => qrToken && navigate(`/loyalty/${qrToken}`)}
                      className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-4 shadow-xs hover:border-[#FFD444] hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      {/* Top Store Info (Concise & customer-focused, no internal cycle numbers) */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center text-[#172033] shrink-0 group-hover:bg-[#FFD444]/20 transition-colors">
                            <Store className="w-4.5 h-4.5 stroke-[2.2]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm sm:text-base text-[#172033] leading-snug truncate">
                              {businessName}
                            </h3>
                            <p className="text-xs text-[#667085] mt-0.5 truncate">
                              {branchName}
                            </p>
                          </div>
                        </div>

                        {unlockedReward && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#EAFBEF] text-[#16A34A] font-bold text-[10px] border border-[#55E07E]/30">
                            Reward Ready
                          </span>
                        )}
                      </div>

                      {/* Loyalty Visualization: exactly cycleLength visual slots */}
                      <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] mb-3">
                        <div className="flex items-center justify-between text-xs mb-2.5">
                          <span className="font-black text-[#172033]">
                            {progressText}
                          </span>
                          <span className="text-xs font-bold text-[#16A34A] truncate max-w-[160px]">
                            {targetRewardName}
                          </span>
                        </div>

                        {/* Visual slots (Completed green, Reward slot with subtle AAO yellow/gold emphasis) */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {Array.from({ length: cycleLength }, (_, i) => {
                            const slotNum = i + 1;
                            const isDone = slotNum <= visitCount;
                            const isRewardSlot = slotNum === cycleLength;

                            if (isRewardSlot) {
                              return (
                                <div
                                  key={`slot-${i}`}
                                  className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${
                                    isDone
                                      ? 'bg-[#EAFBEF] border-2 border-[#55E07E] text-[#0E7A36]'
                                      : unlockedReward
                                      ? 'bg-[#FFFBEB] border-2 border-[#FFD444] text-[#B45309] shadow-xs'
                                      : 'bg-[#FFFDF5] border border-dashed border-[#FFD444]/80 text-[#D97706]'
                                  }`}
                                  title={targetRewardName}
                                >
                                  {isDone ? (
                                    <Check className="w-4 h-4 text-[#0E7A36] stroke-[3]" />
                                  ) : (
                                    <Gift className="w-4 h-4 text-[#D97706]" />
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`slot-${i}`}
                                className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  isDone
                                    ? 'bg-[#EAFBEF] border-2 border-[#55E07E] text-[#0E7A36]'
                                    : 'bg-white border-2 border-dashed border-slate-200 text-[#667085]'
                                }`}
                              >
                                {isDone ? (
                                  <Check className="w-4 h-4 text-[#0E7A36] stroke-[3]" />
                                ) : (
                                  <span className="text-xs font-semibold text-[#667085]">{slotNum}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer Actions: Open Pass → (Clean & uncrowded without redundant program name) */}
                      <div className="flex items-center justify-end pt-0.5">
                        <span className="text-xs font-bold text-[#172033] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Open Pass</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center space-y-3 shadow-xs">
              <div className="flex justify-center">
                <AaoMascot mood="hello" size={80} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033]">
                  No active cards yet
                </h3>
                <p className="text-xs text-[#667085] mt-1 max-w-xs mx-auto leading-relaxed">
                  Scan the counter QR at your favorite shop or explore participating businesses.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => navigate('/customer/scan')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 stroke-[2.2]" />
                  <span>Scan QR Code</span>
                </button>
                <button
                  onClick={() => navigate('/customer/explore')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 text-[#172033] border border-[#E5E7EB] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-4 h-4 stroke-[2.2]" />
                  <span>Explore Places</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Quick Scan Action Card (Secondary to bottom nav with subtle #FFF8D9 light yellow styling) */}
      <section className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FFD444]/20 border border-[#FFD444]/40 flex items-center justify-center text-[#172033] shrink-0">
            <QrCode className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#172033] leading-snug">
              Ready to collect a stamp?
            </h2>
            <p className="text-xs text-[#667085] mt-0.5 leading-snug">
              Scan the shop’s AAO QR code.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/customer/scan')}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-[#FFF8D9] hover:bg-[#FFF3B8] border border-[#FFD444]/40 text-[#172033] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
        >
          <span>Scan QR</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] text-[#172033]" />
        </button>
      </section>

      {/* 5. Recent Activity Feed (Compact Simple List) */}
      {!isLoading && recentVisits.length > 0 && (
        <section className="space-y-2 pt-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#667085] px-1">
            Recent Activity
          </h2>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] px-3 py-1 divide-y divide-slate-100 shadow-xs">
            {recentVisits.map((v) => (
              <div
                key={v.id}
                onClick={() => v.qrToken && navigate(`/loyalty/${v.qrToken}`)}
                className="py-2.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-[#EAFBEF] text-[#16A34A] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                  </div>
                  <div className="text-xs font-semibold text-[#172033] truncate">
                    <span>{v.businessName}</span>
                    <span className="text-[#667085] font-normal mx-1.5">·</span>
                    <span className="text-[#667085] font-normal">
                      Stamp #{v.visitNumber || 1}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] text-[#667085] font-medium shrink-0 ml-3">
                  {new Date(v.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
