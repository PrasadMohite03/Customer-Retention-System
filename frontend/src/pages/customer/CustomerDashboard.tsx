import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import type { CustomerHistoryItem } from '../../services/customerService';
import {
  Sparkles,
  QrCode,
  Gift,
  ArrowRight,
  Store,
  ChevronRight,
  Compass,
  CheckCircle2,
  Calendar,
  Loader2,
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
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

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  // Extract primary loyalty card for each business (active cycle or latest completed cycle)
  const activeCards = history.flatMap((b) => {
    const primaryCycle =
      b.cycles.find((c) => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS') ||
      b.cycles[0];

    if (!primaryCycle) return [];

    const unlockedReward =
      primaryCycle.rewards.find((r) => r.status === 'UNLOCKED') ||
      b.cycles.flatMap((c) => c.rewards).find((r) => r.status === 'UNLOCKED') ||
      null;

    return [{
      businessId: b.business.id,
      businessName: b.business.name,
      businessType: b.business.type,
      qrToken: primaryCycle.qrToken || b.business.branches?.[0]?.qrToken || null,
      branchName: b.business.branches?.[0]?.name || primaryCycle.visits[0]?.branchName || 'Main Branch',
      cycle: primaryCycle,
      unlockedReward,
    }];
  });

  // Extract all recent visits across all businesses
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
    .slice(0, 4);

  // Calculate unlocked rewards count
  const unlockedRewardsCount = history.reduce((acc, b) => {
    return (
      acc +
      b.cycles.reduce(
        (cAcc, c) => cAcc + c.rewards.filter((r) => r.status === 'UNLOCKED').length,
        0
      )
    );
  }, 0);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* 1. Header Greeting Section - RetainPulse Slate & Yellow Accent */}
      <section className="bg-[#172033] -mx-4 -mt-4 p-5 pb-6 text-white rounded-b-2xl shadow-xs relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD444]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD444]" />
            <span>RetainPulse Member</span>
          </div>

          {unlockedRewardsCount > 0 && (
            <button
              onClick={() => navigate('/customer/rewards')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006199] hover:bg-[#004d7a] text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#8ACFF8]/30 active:scale-95"
            >
              <Gift className="w-3.5 h-3.5 text-[#8ACFF8]" />
              <span>{unlockedRewardsCount} Reward{unlockedRewardsCount > 1 ? 's' : ''} Ready</span>
            </button>
          )}
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white relative z-10 leading-tight">
          {getGreeting()}, {firstName}!
        </h1>
        <p className="text-xs text-slate-300 mt-1 font-medium relative z-10">
          {activeCards.length > 0
            ? `You have ${activeCards.length} active loyalty ${activeCards.length === 1 ? 'card' : 'cards'}.`
            : 'Ready to start earning loyalty rewards?'}
        </p>
      </section>

      {/* 2. Quick Scan & Check-in Hero CTA */}
      <section className="bg-[#FFFFFF] rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between gap-4 -mt-3 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#FFD444]/20 border border-[#FFD444]/40 flex items-center justify-center text-[#172033] shrink-0">
            <QrCode className="w-6 h-6 stroke-[2.4]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172033]">At a shop right now?</h2>
            <p className="text-xs text-[#667085] mt-0.5 leading-snug">
              Scan the counter QR to collect your stamp instantly.
            </p>
          </div>
        </div>

        {/* Primary Yellow Action Button */}
        <button
          onClick={() => navigate('/customer/scan')}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <span>Scan</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </section>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-[#667085] gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#FFD444]" />
          <span className="text-xs font-medium">Loading your loyalty cards...</span>
        </div>
      )}

      {/* Error state */}
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

      {/* 3. Active Loyalty Cards Section */}
      {!isLoading && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
              Your Active Passes ({activeCards.length})
            </h2>
            <button
              onClick={() => navigate('/customer/explore')}
              className="text-xs font-bold text-[#006199] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Explore More</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeCards.length > 0 ? (
            <div className="space-y-3">
              {activeCards.map(({ businessId, businessName, qrToken, branchName, cycle, unlockedReward }) => {
                const qualifyingSlots = cycle.cycleLength;
                const totalVisualSlots = qualifyingSlots + 1;
                const isCycleRewardRedeemed = cycle.status === 'COMPLETED' && !unlockedReward;
                const completedVisualSlots = isCycleRewardRedeemed
                  ? totalVisualSlots
                  : Math.min(qualifyingSlots, cycle.visitCount);
                const remaining = Math.max(0, qualifyingSlots - cycle.visitCount);

                return (
                  <div
                    key={`${businessId}-${cycle.id}`}
                    onClick={() => qrToken && navigate(`/loyalty/${qrToken}`)}
                    className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-4.5 shadow-xs hover:border-[#FFD444] hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    {/* Top Store Info */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center text-[#172033] shrink-0 group-hover:bg-[#FFD444]/20 transition-colors">
                          <Store className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#172033] leading-snug group-hover:text-[#172033] transition-colors">
                            {businessName}
                          </h3>
                          <p className="text-xs text-[#667085] mt-0.5">{branchName}</p>
                        </div>
                      </div>

                      {unlockedReward ? (
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#FFD444] text-[#172033] font-bold text-[10px]">
                          🎉 Reward Ready
                        </span>
                      ) : isCycleRewardRedeemed ? (
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#EAFBEF] text-[#55E07E] font-bold text-[10px] border border-[#55E07E]/30">
                          ✓ Redeemed
                        </span>
                      ) : (
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#667085] font-semibold text-[10px] border border-slate-200">
                          Cycle {cycle.cycleNumber}
                        </span>
                      )}
                    </div>

                    {/* Stamp Punch Grid Preview */}
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] mb-3">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-[#172033]">
                          {completedVisualSlots} of {totalVisualSlots}
                        </span>
                        {unlockedReward ? (
                          <span className="text-[11px] font-bold text-[#55E07E] truncate max-w-[160px]">
                            🎉 {unlockedReward.rewardName || unlockedReward.rewardType}
                          </span>
                        ) : isCycleRewardRedeemed ? (
                          <span className="text-[11px] font-bold text-[#55E07E]">
                            ✓ Reward Redeemed
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#667085]">
                            {remaining === 0 ? 'Reward Ready' : `${remaining} visit${remaining !== 1 ? 's' : ''} to reward`}
                          </span>
                        )}
                      </div>

                      {/* Small Stamp Dots */}
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalVisualSlots }, (_, i) => {
                          const slotNum = i + 1;
                          const isRewardSlot = slotNum === totalVisualSlots;
                          const isDone = isRewardSlot ? isCycleRewardRedeemed : slotNum <= cycle.visitCount;

                          return (
                            <div
                              key={i}
                              className={`flex-1 h-3 rounded-full transition-all ${
                                isDone
                                  ? 'bg-[#55E07E] shadow-xs'
                                  : isRewardSlot && unlockedReward
                                  ? 'bg-[#FFD444] animate-pulse'
                                  : isRewardSlot
                                  ? 'bg-[#EAFBEF] border border-[#55E07E]/40'
                                  : 'bg-slate-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-[#667085] flex items-center gap-1">
                        <span>Program: {cycle.programName || 'Loyalty Pass'}</span>
                      </span>

                      {unlockedReward ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (qrToken) navigate(`/loyalty/${qrToken}`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Show Reward</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (qrToken) navigate(`/loyalty/${qrToken}`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{cycle.status === 'COMPLETED' ? 'View Card' : 'Check In'}</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#FFFFFF] rounded-2xl border-2 border-dashed border-[#E5E7EB] p-8 text-center space-y-3">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-[#172033]">No active loyalty cards yet</h3>
                <p className="text-xs text-[#667085] mt-1 max-w-xs mx-auto">
                  Explore participating local places or scan a QR code at your favorite shop to start earning stamps!
                </p>
              </div>
              <button
                onClick={() => navigate('/customer/explore')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Compass className="w-4 h-4 stroke-[2.2]" />
                <span>Explore Businesses</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. Recent Stamp Activity */}
      {!isLoading && recentVisits.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
            Recent Stamp Activity
          </h2>
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] divide-y divide-[#E5E7EB] shadow-xs overflow-hidden">
            {recentVisits.map((v) => (
              <div
                key={v.id}
                onClick={() => v.qrToken && navigate(`/loyalty/${v.qrToken}`)}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FFD444]/20 text-[#172033] flex items-center justify-center font-bold text-xs shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#172033]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#172033] leading-snug">
                      {v.businessName}
                    </h4>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Stamp #{v.visitNumber} of {v.cycleLength} • {v.branchName}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-[#667085] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#667085]" />
                    {new Date(v.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
