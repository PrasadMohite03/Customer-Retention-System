import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Copy,
  Check,
  X,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Gift,
  Store,
  Clock,
} from 'lucide-react';
import type { CustomerRewardItem } from '../../services/customerService';
import { AaoMascot } from '../ui/AaoBrand';

interface RewardQrModalProps {
  reward: CustomerRewardItem | null;
  businessName?: string;
  onClose: () => void;
}

export const RewardQrModal: React.FC<RewardQrModalProps> = ({
  reward,
  businessName,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!reward) return null;

  const isUnlocked = reward.status === 'UNLOCKED';
  const rawToken = reward.redemptionToken || '';
  const displayName = reward.rewardName || reward.rewardType.replace(/_/g, ' ');

  const handleCopy = async () => {
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#FFFFFF] shadow-xl border border-[#E5E7EB] overflow-hidden flex flex-col text-[#172033]">
        {/* Header - Warm AAO Light Styling */}
        <div
          className={`p-5 pt-6 relative text-center border-b ${
            isUnlocked
              ? 'bg-[#FFFDF5] border-[#FFD444]/30'
              : 'bg-[#EAFBEF] border-[#55E07E]/30'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/80 hover:bg-white text-[#667085] hover:text-[#172033] transition-colors cursor-pointer shadow-2xs"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Status pill & mascot banner */}
          <div className="flex flex-col items-center">
            {isUnlocked ? (
              <>
                <div className="mb-2">
                  <AaoMascot mood="reward" size={60} className="mx-auto" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#55E07E]/40 text-[#0E7A36] text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                  <Gift className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>YOUR REWARD IS READY!</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2">
                  <AaoMascot mood="celebrate" size={60} className="mx-auto" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#55E07E]/50 text-[#0E7A36] text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>REWARD REDEEMED</span>
                </div>
              </>
            )}

            <h3 className="text-lg sm:text-xl font-black tracking-tight text-[#172033] leading-snug">
              {displayName}
            </h3>
            {businessName && (
              <p className="text-xs text-[#667085] mt-1 flex items-center justify-center gap-1.5 font-bold">
                <Store className="w-3.5 h-3.5 text-[#667085]" />
                <span>{businessName}</span>
              </p>
            )}
            {reward.rewardValue && (
              <p className="text-xs font-extrabold text-[#0E7A36] mt-0.5">
                Value: {reward.rewardValue}
              </p>
            )}
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 flex flex-col items-center text-center">
          {isUnlocked ? (
            <>
              {/* UNLOCKED: Show Reward QR Container */}
              <div className="p-4 bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col items-center justify-center mb-3">
                {rawToken ? (
                  <QRCodeSVG
                    value={rawToken}
                    size={180}
                    level="M"
                    includeMargin
                    className="w-full h-auto max-w-[180px]"
                  />
                ) : (
                  <div className="w-40 h-40 flex flex-col items-center justify-center text-[#667085]">
                    <QrCode className="w-10 h-10 mb-2 text-slate-400" />
                    <span className="text-xs">QR Code Ready</span>
                  </div>
                )}
              </div>

              {/* Informational Guidance */}
              <div className="flex items-center gap-2 text-xs font-medium text-[#172033] mb-3 bg-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] w-full text-left">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span className="text-xs leading-relaxed text-[#172033]">
                  Present this QR to store staff at checkout to redeem your reward.
                </span>
              </div>

              {/* Fallback Token Code Display */}
              {rawToken && (
                <div className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="text-left overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-[#667085] block tracking-wider">
                      Redemption Code
                    </span>
                    <span className="font-mono text-xs font-bold text-[#172033] tracking-wider truncate block">
                      {rawToken}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] text-xs font-bold text-[#172033] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span className="text-[#16A34A] font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#667085]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* REDEEMED: Celebratory Presentation View */}
              <div className="w-full space-y-3">
                {/* Main Success Title */}
                <div className="py-1">
                  <h4 className="text-sm font-black text-[#0E7A36] mb-0.5">
                    See you again!
                  </h4>
                  <p className="text-xs text-[#667085]">
                    Thank you for being a valued loyal customer.
                  </p>
                </div>

                {/* Compact Info Card */}
                <div className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-3.5 space-y-2 text-left shadow-2xs">
                  {reward.redeemedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085] flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#667085]" />
                        <span>Redeemed On</span>
                      </span>
                      <span className="font-bold text-[#172033]">
                        {formatDate(reward.redeemedAt)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667085] flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                      <span>Unlocked On</span>
                    </span>
                    <span className="font-bold text-[#172033]">
                      {formatDate(reward.unlockedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667085] font-medium">Loyalty Cycle</span>
                    <span className="font-bold text-[#172033]">
                      Cycle {reward.cycleNumber}
                    </span>
                  </div>
                </div>

                {/* Simplified note */}
                <div className="bg-[#FFFDF5] border border-[#FFD444]/30 rounded-xl p-2.5 text-left">
                  <p className="text-[11px] text-[#667085] leading-relaxed">
                    This reward has already been redeemed. Keep collecting stamps for your next reward!
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Close Action Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-sm tracking-wide transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
