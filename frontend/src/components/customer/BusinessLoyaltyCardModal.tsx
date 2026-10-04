import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExploreBusinessItem } from '../../services/customerService';
import {
  X,
  MapPin,
  Sparkles,
  Gift,
  CheckCircle2,
  ArrowRight,
  Info,
  Award,
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

  if (!business) return null;

  const cycleLength = business.program?.cycleLength || 5;
  const currentStamps = business.currentVisitCount || 0;
  const milestones = business.program?.milestones || [];
  const qrToken = business.branch?.qrToken;

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
        return 'Salon & Spa';
      case 'FITNESS':
        return 'Fitness & Gym';
      case 'RETAIL':
        return 'Retail Store';
      default:
        return cat;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#FFFFFF] shadow-xl border border-[#E5E7EB] overflow-hidden flex flex-col my-auto max-h-[90vh] text-[#172033]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FFFFFF]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FFD444]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
              Loyalty Program
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-[#667085] hover:text-[#172033] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 1. DIGITAL LOYALTY CARD (Light Surface & Yellow/Blue Brand Styling) */}
          <div className="rounded-2xl p-4.5 bg-[#FFFFFF] border border-[#E5E7EB] shadow-xs space-y-3.5">
            {/* Business Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFD444] text-[#172033] text-[10px] font-extrabold uppercase tracking-wide mb-1.5">
                  {formatCategory(business.type)}
                </span>
                <h3 className="text-lg font-black tracking-tight text-[#172033] leading-snug">
                  {business.name}
                </h3>
                {business.branch && (
                  <p className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                    <span>
                      {business.branch.name}
                      {business.branch.address ? ` • ${business.branch.address}` : ''}
                    </span>
                  </p>
                )}
              </div>

              {business.isEnrolled ? (
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#006199]/10 border border-[#006199]/20 text-[#006199] text-[10px] font-bold">
                  Enrolled
                </span>
              ) : (
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[#667085] text-[10px] font-semibold">
                  New Pass
                </span>
              )}
            </div>

            {/* Loyalty Program Description */}
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider block">
                Program Name
              </span>
              <p className="text-xs font-bold text-[#172033] mt-0.5">
                {business.program?.name || 'Customer Rewards Club'}
              </p>
              {business.program?.description && (
                <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                  {business.program.description}
                </p>
              )}
            </div>

            {/* Visual Stamp Card Grid */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#172033] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FFD444]" />
                  <span>Stamp Progress</span>
                </span>
                <span className="font-bold text-[#006199]">
                  {business.isEnrolled
                    ? `${currentStamps} of ${cycleLength} collected`
                    : `${cycleLength} stamps per cycle`}
                </span>
              </div>

              {/* Grid of Stamp Slots */}
              <div className="grid grid-cols-5 gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                {Array.from({ length: cycleLength }, (_, i) => {
                  const stampNum = i + 1;
                  const isCompleted = business.isEnrolled && currentStamps >= stampNum;
                  const milestone = milestones.find((m) => m.visitNumber === stampNum);
                  const isNext = business.isEnrolled && currentStamps + 1 === stampNum;

                  return (
                    <div
                      key={stampNum}
                      className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-[#FFD444] text-[#172033] shadow-xs'
                          : isNext
                          ? 'bg-[#FFFFFF] border-2 border-dashed border-[#FFD444] text-[#172033]'
                          : milestone
                          ? 'bg-[#FFFFFF] border border-[#8ACFF8] text-[#006199]'
                          : 'bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085]'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-[#172033] stroke-[2.5]" />
                      ) : milestone ? (
                        <Gift className="w-4 h-4 text-[#006199]" />
                      ) : (
                        <span className="text-xs font-bold">{stampNum}</span>
                      )}

                      {/* Milestone badge indicator */}
                      {milestone && (
                        <span
                          title={milestone.rewardName || 'Reward'}
                          className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black shadow-xs ${
                            isCompleted ? 'bg-[#172033] text-[#FFD444]' : 'bg-[#006199] text-white'
                          }`}
                        >
                          ★
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. MILESTONES & REWARDS LIST */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#006199]" />
              <span>Program Rewards & Milestones</span>
            </h4>

            {milestones.length > 0 ? (
              <div className="space-y-2">
                {milestones.map((m) => {
                  const title = m.rewardName || m.rewardType.replace(/_/g, ' ');
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#006199]/10 text-[#006199] flex items-center justify-center font-bold text-xs shrink-0">
                          <Gift className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#172033] leading-snug">{title}</p>
                          {m.rewardDescription && (
                            <p className="text-[11px] text-[#667085] mt-0.5">{m.rewardDescription}</p>
                          )}
                          {m.rewardValue && (
                            <span className="inline-block text-[10px] font-semibold text-[#006199] mt-0.5">
                              Value: {m.rewardValue}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#006199]/10 text-[#006199] font-bold text-[10px]">
                          Visit {m.visitNumber}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#667085] italic p-3 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB]">
                Complete your cycle to earn special in-store loyalty rewards.
              </p>
            )}
          </div>

          {/* 3. HOW IT WORKS */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#006199]" />
              <span>How It Works</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB]">
                <span className="w-5 h-5 rounded-full bg-[#FFD444] text-[#172033] font-bold text-xs flex items-center justify-center mx-auto mb-1">
                  1
                </span>
                <p className="text-[11px] font-bold text-[#172033]">Visit Store</p>
                <p className="text-[10px] text-[#667085] mt-0.5">Drop by the branch</p>
              </div>

              <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB]">
                <span className="w-5 h-5 rounded-full bg-[#FFD444] text-[#172033] font-bold text-xs flex items-center justify-center mx-auto mb-1">
                  2
                </span>
                <p className="text-[11px] font-bold text-[#172033]">Scan QR</p>
                <p className="text-[10px] text-[#667085] mt-0.5">Scan counter code</p>
              </div>

              <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB]">
                <span className="w-5 h-5 rounded-full bg-[#FFD444] text-[#172033] font-bold text-xs flex items-center justify-center mx-auto mb-1">
                  3
                </span>
                <p className="text-[11px] font-bold text-[#172033]">Get Reward</p>
                <p className="text-[10px] text-[#667085] mt-0.5">Cashier applies reward</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Action Button */}
        <div className="p-4 border-t border-[#E5E7EB] bg-[#FFFFFF] flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-slate-50 text-[#172033] font-bold text-xs transition-colors cursor-pointer text-center"
          >
            Close
          </button>

          {qrToken ? (
            <button
              type="button"
              onClick={handleOpenPass}
              className="flex-2 py-2.5 px-4 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{business.isEnrolled ? 'Open Loyalty Pass' : 'Start Loyalty Pass'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          ) : (
            <div className="flex-2 text-center text-xs text-[#667085] font-medium py-2">
              Visit location to scan QR
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
