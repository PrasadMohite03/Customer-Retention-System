import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExploreBusinessItem } from '../../services/customerService';
import {
  ArrowLeft,
  MapPin,
  Gift,
  ArrowRight,
  Coffee,
  Store,
  Scissors,
  Dumbbell,
  Car,
  Utensils,
  Sparkles,
} from 'lucide-react';

interface BusinessLoyaltyCardModalProps {
  business: ExploreBusinessItem | null;
  onClose: () => void;
}

export const BusinessLoyaltyCardModal: React.FC<BusinessLoyaltyCardModalProps> = ({
  business,
  onClose,
}) => {
  const navigate = useNavigate();

  // Handle ESC key to close full screen
  useEffect(() => {
    if (!business) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while dedicated screen is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [business, onClose]);

  if (!business) return null;

  const cycleLength = business.program?.cycleLength || 4;
  const milestones = business.program?.milestones || [];
  const rewardMilestones = milestones.filter(
    (m) => m.rewardType && m.rewardType !== 'NONE'
  );
  const qrToken = business.branch?.qrToken;

  // Dynamic slot sizing based on total count to ensure multi-row elegance
  const isCompactSlots = cycleLength >= 8;
  const slotSizeClass = isCompactSlots
    ? 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl'
    : 'w-10 h-10 sm:w-11 sm:h-11 rounded-xl';
  const slotIconClass = isCompactSlots
    ? 'w-4 h-4 stroke-[2.2]'
    : 'w-4.5 h-4.5 stroke-[2.2]';

  const handleOpenPass = () => {
    if (!qrToken) return;
    onClose();
    navigate(`/loyalty/${qrToken}`);
  };

  // Helper to format category
  const formatCategory = (cat: string | null) => {
    if (!cat) return 'Local Business';
    switch (cat.toUpperCase()) {
      case 'CAFE':
        return 'Cafe & Coffee';
      case 'RESTAURANT':
        return 'Dining & Restaurant';
      case 'SALON':
        return 'Salon & Beauty';
      case 'FITNESS':
        return 'Gym & Fitness';
      case 'RETAIL':
        return 'Retail Store';
      case 'CAR_WASH':
      case 'CARWASH':
      case 'AUTO':
        return 'Car Wash';
      case 'WELLNESS':
        return 'Wellness';
      default:
        return cat;
    }
  };

  // Category Icon Resolver
  const getCategoryIcon = (cat: string | null) => {
    if (!cat) return <Store className="w-3 h-3 stroke-[2.5]" />;
    const normalized = cat.toUpperCase();
    if (normalized.includes('CAFE') || normalized.includes('COFFEE')) {
      return <Coffee className="w-3 h-3 stroke-[2.5]" />;
    }
    if (normalized.includes('RESTAURANT') || normalized.includes('DINING') || normalized.includes('FOOD')) {
      return <Utensils className="w-3 h-3 stroke-[2.5]" />;
    }
    if (normalized.includes('SALON') || normalized.includes('BEAUTY') || normalized.includes('SPA') || normalized.includes('HAIR')) {
      return <Scissors className="w-3 h-3 stroke-[2.5]" />;
    }
    if (normalized.includes('FITNESS') || normalized.includes('GYM')) {
      return <Dumbbell className="w-3 h-3 stroke-[2.5]" />;
    }
    if (normalized.includes('CAR') || normalized.includes('AUTO')) {
      return <Car className="w-3 h-3 stroke-[2.5]" />;
    }
    if (normalized.includes('WELLNESS')) {
      return <Sparkles className="w-3 h-3 stroke-[2.5]" />;
    }
    return <Store className="w-3 h-3 stroke-[2.5]" />;
  };

  return (
    <div
      role="region"
      aria-label="AAO Loyalty Program Details"
      className="fixed inset-0 z-50 bg-[#FFFFFF] flex flex-col w-full h-full min-h-screen text-[#172033] overflow-hidden"
    >
      {/* 1. Dedicated Screen Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 sm:px-6 py-3 flex items-center shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 -ml-1 mr-2.5 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD444] shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-[#172033] truncate">
            AAO LOYALTY PROGRAM
          </span>
        </div>
      </header>

      {/* 2. Full Dedicated Screen Body - Natural Cohesive Flow */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3.5 pb-3 sm:pb-4 w-full max-w-xl mx-auto space-y-3.5 sm:space-y-4 overflow-x-hidden">
        {/* 1. Business Identity Card (Warm/off-white #FFF8E1 card with #FFE08A border) */}
        <div className="bg-[#FFF8E1] border border-[#FFE08A] rounded-2xl p-4 min-w-0 w-full shadow-2xs">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFD444] text-[#172033] text-[10px] font-extrabold uppercase tracking-wide mb-2 shadow-2xs">
            {getCategoryIcon(business.type)}
            <span>{formatCategory(business.type)}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#172033] leading-snug break-words [overflow-wrap:anywhere]">
            {business.name}
          </h1>
          {business.branch && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-[#667085] leading-normal min-w-0 w-full pt-2 border-t border-[#FFE08A]/70">
              <MapPin className="w-3.5 h-3.5 text-[#667085] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] space-y-0.5">
                <span className="font-semibold text-[#172033] block">
                  {business.branch.name}
                </span>
                {business.branch.address && (
                  <span className="text-[#667085] block">
                    {business.branch.address}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Loyalty Program / Tagline */}
        <div className="py-0.5">
          <h2 className="text-base sm:text-lg font-black text-[#172033] tracking-tight leading-tight">
            Collect stamps. Unlock rewards.
          </h2>
        </div>

        {/* 3. Loyalty Stamp Card (EXACTLY cycleLength visual slots) */}
        <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-3.5 sm:p-4 text-center shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#667085] block mb-2.5">
            Loyalty Stamp Card ({cycleLength} visits)
          </span>

          {/* Stamp Slots (EXACTLY cycleLength visual slots) */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap max-w-[280px] sm:max-w-xs mx-auto">
            {Array.from({ length: cycleLength }, (_, i) => {
              const slotNum = i + 1;
              const milestone = milestones.find((m) => m.visitNumber === slotNum);
              const hasReward = Boolean(milestone && milestone.rewardType && milestone.rewardType !== 'NONE');

              if (hasReward) {
                return (
                  <div key={`stamp-slot-${slotNum}`} className="shrink-0" title={`Visit ${slotNum} Reward`}>
                    <div className={`${slotSizeClass} bg-[#FFFDF5] border-2 border-dashed border-[#FFD444] flex items-center justify-center text-[#D97706] shadow-2xs`}>
                      <Gift className={slotIconClass} />
                    </div>
                  </div>
                );
              }

              return (
                <div key={`stamp-slot-${slotNum}`} className="shrink-0" title={`Visit ${slotNum}`}>
                  <div className={`${slotSizeClass} bg-[#FFFFFF] border-2 border-dashed border-slate-300 flex items-center justify-center text-[#667085] shadow-2xs`}>
                    <span className="text-xs font-bold text-[#667085]">{slotNum}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[#667085] mt-2.5 font-semibold">
            Collect stamps with every visit
          </p>
        </div>

        {/* 4. Program Rewards Section (Shows ALL milestone rewards for this program) */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block mb-1">
            Program Rewards ({rewardMilestones.length})
          </span>
          {rewardMilestones.length > 0 ? (
            rewardMilestones.map((m) => {
              const rawTitle = m.rewardName || (m.rewardType ? m.rewardType.replace(/_/g, ' ') : 'Reward');
              const isFree = m.rewardType === 'FREE_ITEM' || m.rewardType === 'FREE_SERVICE' || m.rewardType === 'FREE_PRODUCT';
              const title = isFree && !rawTitle.toLowerCase().startsWith('free') ? `Free ${rawTitle}` : rawTitle;

              return (
                <div
                  key={m.id || m.visitNumber}
                  className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-left shadow-2xs"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#FFD444]/20 text-[#D97706] flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-[#172033] truncate">
                        {title}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] bg-slate-200/70 px-2 py-0.5 rounded-full shrink-0">
                        Locked
                      </span>
                    </div>
                    <p className="text-xs text-[#667085] mt-0.5 leading-snug">
                      After {m.visitNumber} qualifying visit{m.visitNumber !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-left shadow-2xs">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#FFD444]/20 text-[#D97706] flex items-center justify-center shrink-0">
                <Gift className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-[#172033]">In-Store Reward</h3>
                <p className="text-xs text-[#667085] mt-0.5">After {cycleLength} qualifying visits</p>
              </div>
            </div>
          )}
        </div>

        {/* 5. How It Works */}
        <div className="pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block mb-2">
            How It Works
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-5 h-5 rounded-full bg-[#FFD444] text-[#172033] font-black text-[11px] flex items-center justify-center mx-auto mb-1 shadow-2xs">
                1
              </span>
              <p className="text-xs font-bold text-[#172033]">Visit</p>
              <p className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 leading-tight">Make a purchase</p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-5 h-5 rounded-full bg-[#FFD444] text-[#172033] font-black text-[11px] flex items-center justify-center mx-auto mb-1 shadow-2xs">
                2
              </span>
              <p className="text-xs font-bold text-[#172033]">Scan</p>
              <p className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 leading-tight">Scan the AAO QR</p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-5 h-5 rounded-full bg-[#55E07E] text-[#172033] font-black text-[11px] flex items-center justify-center mx-auto mb-1 shadow-2xs">
                3
              </span>
              <p className="text-xs font-bold text-[#172033]">Earn</p>
              <p className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 leading-tight">Get your stamp</p>
            </div>
          </div>
        </div>
      </main>

      {/* 6. Sticky Bottom Action Area (Single full-width CTA button) */}
      <footer className="sticky bottom-0 z-30 bg-[#FFFFFF] border-t border-[#E5E7EB] p-3.5 sm:p-4 shrink-0 shadow-lg">
        <div className="max-w-xl mx-auto w-full">
          <button
            type="button"
            onClick={handleOpenPass}
            disabled={!qrToken}
            className={`w-full py-3 px-4 rounded-xl font-black text-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
              qrToken
                ? 'bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] shadow-xs'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Join & Earn Stamps</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </footer>
    </div>
  );
};
