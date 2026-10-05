import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Gift,
  Store,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { RewardClaimData } from '../../services/customerService';
import { AaoMascot } from '../ui/AaoBrand';

interface ClaimRewardQrModalProps {
  claim: RewardClaimData | null;
  isRedeemed: boolean;
  onClose: () => void;
}

export const ClaimRewardQrModal: React.FC<ClaimRewardQrModalProps> = ({
  claim,
  isRedeemed,
  onClose,
}) => {
  if (!claim) return null;

  const rewardName = claim.reward.name || 'Reward';
  const businessName = claim.business.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-xl border border-[#E5E7EB] overflow-hidden flex flex-col text-[#172033]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#667085] hover:text-[#172033] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Mascot & Header Area - Light AAO Surface */}
        <div className={`pt-7 pb-4 px-6 text-center transition-colors ${isRedeemed ? 'bg-[#EAFBEF]' : 'bg-[#FFFDF5]'}`}>
          <div className="flex flex-col items-center">
            {isRedeemed ? (
              <>
                <div className="mb-2">
                  <AaoMascot mood="celebrate" size={72} className="mx-auto" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#55E07E]/50 text-[#0E7A36] text-[11px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#0E7A36]" />
                  <span>YOU DID IT!</span>
                </div>
                <h3 className="text-xl font-black tracking-tight text-[#172033] leading-snug">
                  Your {rewardName} has been redeemed.
                </h3>
                <p className="text-xs text-[#0E7A36] font-bold mt-1">
                  See you again!
                </p>
              </>
            ) : (
              <>
                <div className="mb-2">
                  <AaoMascot mood="reward" size={72} className="mx-auto" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD444] text-[#172033] text-[11px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                  <Gift className="w-3.5 h-3.5 text-[#172033]" />
                  <span>CLAIM YOUR REWARD</span>
                </div>
                <h3 className="text-xl font-black tracking-tight text-[#172033] leading-tight">
                  {rewardName}
                </h3>
                {businessName && (
                  <p className="text-xs text-[#667085] mt-1 flex items-center justify-center gap-1 font-semibold">
                    <Store className="w-3.5 h-3.5 text-[#667085]" />
                    <span>{businessName}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 pt-4 flex flex-col items-center text-center space-y-4">
          {!isRedeemed ? (
            <>
              {/* QR Code Container - Compact & Highly Scannable */}
              <div className="p-3.5 bg-white rounded-2xl border-2 border-[#FFD444]/70 shadow-xs flex flex-col items-center justify-center">
                <QRCodeSVG
                  value={claim.claimToken}
                  size={172}
                  level="M"
                  includeMargin
                  className="w-full h-auto max-w-[172px]"
                />
              </div>

              {/* Instructions & Meta Badge */}
              <div className="w-full bg-[#F8FAFC] border border-[#E5E7EB] p-3.5 rounded-2xl text-left space-y-2.5">
                <p className="text-xs font-bold text-[#172033] leading-snug text-center">
                  Show this QR to store staff to complete your final visit and claim your reward.
                </p>
                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#667085]">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Single-use QR</span>
                  </span>
                  <span className="font-bold text-[#172033]">
                    Visit #{claim.expectedVisitNumber} of {claim.cycleLength}
                  </span>
                </div>
              </div>

              {/* Subtle Footer Copy */}
              <p className="text-[11px] text-[#667085] leading-normal px-2">
                Staff will scan this code to record your final visit and redeem your reward.
              </p>
            </>
          ) : (
            <>
              <div className="w-full bg-[#EAFBEF] border border-[#55E07E]/40 p-4 rounded-2xl text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-[#55E07E]/30 text-[#0E7A36] flex items-center justify-center mx-auto mb-1">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-[#0E7A36]">
                  Visit recorded & reward redeemed!
                </p>
                <p className="text-[11px] text-[#667085]">
                  Your stamp card will begin a fresh loyalty cycle on your next visit.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 bg-[#FFD444] hover:bg-[#FACC15] text-[#172033] rounded-xl text-sm font-black transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
