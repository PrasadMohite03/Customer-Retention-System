import React, { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import type {
  CustomerHistoryItem,
  CustomerRewardItem,
} from '../../services/customerService';
import { RewardQrModal } from '../../components/customer/RewardQrModal';
import {
  Gift,
  CheckCircle2,
  Calendar,
  Store,
  QrCode,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface FlattenedReward {
  id: string;
  businessName: string;
  rewardType: string;
  rewardName?: string | null;
  rewardValue?: string | null;
  status: 'UNLOCKED' | 'REDEEMED';
  unlockedAt: string;
  redeemedAt?: string | null;
  redemptionToken?: string | null;
  cycleNumber: number;
}

export const CustomerRewards: React.FC = () => {
  const [tab, setTab] = useState<'AVAILABLE' | 'ALL' | 'REDEEMED'>('AVAILABLE');
  const [rewards, setRewards] = useState<FlattenedReward[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected reward for modal (interactive on ALL, AVAILABLE, and REDEEMED)
  const [selectedReward, setSelectedReward] = useState<FlattenedReward | null>(null);

  const loadRewards = useCallback(async () => {
    try {
      setError(null);
      const history: CustomerHistoryItem[] = await customerService.getCustomerHistory();

      const flat: FlattenedReward[] = [];
      for (const item of history) {
        for (const cycle of item.cycles) {
          for (const rew of cycle.rewards) {
            flat.push({
              id: rew.id,
              businessName: item.business.name,
              rewardType: rew.rewardType,
              rewardName: rew.rewardName,
              rewardValue: rew.rewardValue,
              status: rew.status,
              unlockedAt: rew.unlockedAt,
              redeemedAt: rew.redeemedAt,
              redemptionToken: rew.redemptionToken,
              cycleNumber: cycle.cycleNumber,
            });
          }
        }
      }

      // Sort with UNLOCKED first, then by date descending
      flat.sort((a, b) => {
        if (a.status === 'UNLOCKED' && b.status !== 'UNLOCKED') return -1;
        if (b.status === 'UNLOCKED' && a.status !== 'UNLOCKED') return 1;
        return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
      });

      setRewards(flat);
    } catch (err: any) {
      console.error('Failed to load rewards:', err);
      setError('Unable to load your rewards. Please tap to retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const availableRewards = rewards.filter((r) => r.status === 'UNLOCKED');
  const redeemedRewards = rewards.filter((r) => r.status === 'REDEEMED');

  const displayedRewards =
    tab === 'AVAILABLE'
      ? availableRewards
      : tab === 'REDEEMED'
      ? redeemedRewards
      : rewards;

  // Convert to CustomerRewardItem format for modal
  const modalReward: CustomerRewardItem | null = selectedReward
    ? {
        id: selectedReward.id,
        rewardType: selectedReward.rewardType,
        rewardName: selectedReward.rewardName,
        rewardValue: selectedReward.rewardValue,
        unlockedAt: selectedReward.unlockedAt,
        redeemedAt: selectedReward.redeemedAt,
        cycleNumber: selectedReward.cycleNumber,
        status: selectedReward.status,
        redemptionToken: selectedReward.redemptionToken,
      }
    : null;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD444]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#172033]">
            My Rewards & Vouchers
          </span>
        </div>
        <h1 className="text-xl font-black tracking-tight text-[#172033]">Your Rewards</h1>
        <p className="text-xs text-[#667085] mt-0.5">
          Tap any reward to view details or present your redemption QR code at checkout.
        </p>
      </div>

      {/* Tabs */}
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
            {availableRewards.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('ALL')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tab === 'ALL'
              ? 'bg-[#FFFFFF] text-[#172033] shadow-xs'
              : 'text-[#667085] hover:text-[#172033]'
          }`}
        >
          <span>All</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300 text-[#667085] font-semibold">
            {rewards.length}
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
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-300 text-[#667085] font-semibold">
            {redeemedRewards.length}
          </span>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-[#667085] gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#FFD444]" />
          <span className="text-xs font-medium">Loading your reward vouchers...</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadRewards}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Rewards List */}
      {!isLoading && (
        <div className="space-y-3 pt-1">
          {displayedRewards.length > 0 ? (
            displayedRewards.map((reward) => {
              const isUnlocked = reward.status === 'UNLOCKED';
              const name = reward.rewardName || reward.rewardType.replace(/_/g, ' ');
              const isSelected = selectedReward?.id === reward.id;

              return (
                <div
                  key={reward.id}
                  onClick={() => setSelectedReward(reward)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedReward(reward);
                    }
                  }}
                  className={`w-full text-left rounded-2xl border transition-all overflow-hidden cursor-pointer select-none active:scale-[0.98] ${
                    isSelected ? 'ring-2 ring-[#FFD444]' : ''
                  } ${
                    isUnlocked
                      ? 'bg-[#FFFFFF] border-[#E5E7EB] shadow-xs hover:border-[#FFD444] hover:shadow-sm'
                      : 'bg-[#FFFFFF]/80 border-[#E5E7EB] opacity-80 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <div className="p-4">
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[#667085] flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#667085]" />
                        <span>{reward.businessName}</span>
                      </span>

                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAFBEF] text-[#0E7A36] font-extrabold text-[10px] border border-[#55E07E]/30">
                          <Gift className="w-3 h-3 text-[#16A34A]" />
                          <span>AVAILABLE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#667085] font-semibold text-[10px] border border-slate-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>REDEEMED</span>
                        </span>
                      )}
                    </div>

                    {/* Reward Title & Value */}
                    <div className="flex items-start justify-between gap-3 my-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-[#172033] leading-snug">
                          {name}
                        </h3>
                        {reward.rewardValue && (
                          <p className="text-xs text-[#0E7A36] font-bold mt-0.5">
                            Value: {reward.rewardValue}
                          </p>
                        )}
                        <p className="text-[11px] text-[#667085] mt-1">
                          Cycle {reward.cycleNumber} Reward
                        </p>
                      </div>

                      {/* Reward icon */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          isUnlocked
                            ? 'bg-[#EAFBEF] text-[#16A34A] border border-[#55E07E]/30 shadow-xs'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        <Gift className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Dates & Action CTA */}
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                      <div className="text-[11px] text-[#667085] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#667085]" />
                        {isUnlocked ? (
                          <span>
                            Unlocked on{' '}
                            {new Date(reward.unlockedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        ) : (
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
                        )}
                      </div>

                      {/* Interactive Button */}
                      {isUnlocked ? (
                        <span className="px-3.5 py-1.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Show Reward</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#172033] hover:text-[#000000] flex items-center gap-1">
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-[#FFFFFF] rounded-2xl border-2 border-dashed border-[#E5E7EB] p-8 text-center space-y-2">
              <Gift className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-[#172033]">
                {tab === 'AVAILABLE'
                  ? 'No available rewards right now'
                  : tab === 'REDEEMED'
                  ? 'No redeemed rewards in history'
                  : 'No rewards unlocked yet'}
              </h4>
              <p className="text-xs text-[#667085] max-w-xs mx-auto">
                Visit participating places and collect stamps to unlock special rewards and vouchers.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Unified Reward Detail / Presentation Modal */}
      <RewardQrModal
        reward={modalReward}
        businessName={selectedReward?.businessName}
        onClose={() => setSelectedReward(null)}
      />
    </div>
  );
};
