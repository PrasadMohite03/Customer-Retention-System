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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#FFFFFF] shadow-2xl border border-slate-100 overflow-hidden flex flex-col text-[#172033]">
        {/* Header - Sleek #172033 for UNLOCKED, Neutral Slate for REDEEMED */}
        <div
          className={`p-5 pt-6 relative text-center text-white ${
            isUnlocked ? 'bg-[#172033]' : 'bg-slate-900'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Status pill */}
          {isUnlocked ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs font-extrabold mb-2.5 shadow-xs">
              <Gift className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>UNLOCKED REWARD</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-slate-300 text-xs font-semibold mb-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#55E07E]" />
              <span>REDEEMED IN STORE</span>
            </div>
          )}

          <h3 className="text-xl font-black tracking-tight text-white leading-tight">
            {displayName}
          </h3>
          {businessName && (
            <p className="text-xs text-slate-300 mt-1.5 flex items-center justify-center gap-1.5 font-medium">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span>{businessName}</span>
            </p>
          )}
          {reward.rewardValue && (
            <p className="text-xs font-bold text-[#FFD444] mt-1">
              Value: {reward.rewardValue}
            </p>
          )}
        </div>

        {/* Content body */}
        <div className="p-6 flex flex-col items-center text-center">
          {isUnlocked ? (
            <>
              {/* UNLOCKED: Show Reward QR Container */}
              <div className="p-4 bg-[#FFFFFF] rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mb-4">
                {rawToken ? (
                  <QRCodeSVG
                    value={rawToken}
                    size={200}
                    level="M"
                    includeMargin
                    className="w-full h-auto max-w-[200px]"
                  />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-[#667085]">
                    <QrCode className="w-12 h-12 mb-2 text-slate-400" />
                    <span className="text-xs">QR Code Ready</span>
                  </div>
                )}
              </div>

              {/* Informational Guidance (No Customer Redeem Action) */}
              <div className="flex items-center gap-2.5 text-xs font-medium text-[#172033] mb-4 bg-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span className="text-left text-xs leading-relaxed text-[#172033]">
                  Present this QR to store staff at checkout. Staff will scan to validate & apply.
                </span>
              </div>

              {/* Fallback Token Code Display */}
              {rawToken && (
                <div className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
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
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-semibold text-[#172033] hover:bg-slate-50 transition-colors shadow-xs cursor-pointer active:scale-95"
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
              {/* REDEEMED: Presentation View */}
              <div className="w-full space-y-4 py-2">
                <div className="w-16 h-16 rounded-full bg-[#EAFBEF] border border-[#55E07E]/40 flex items-center justify-center mx-auto text-[#16A34A]">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                </div>

                <div>
                  <h4 className="text-base font-bold text-[#172033]">
                    Already Redeemed
                  </h4>
                  <p className="text-xs text-[#667085] mt-1">
                    This reward was verified and redeemed at the counter.
                  </p>
                </div>

                <div className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 space-y-2 text-left">
                  {reward.redeemedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#667085]" />
                        <span>Redeemed On</span>
                      </span>
                      <span className="font-semibold text-[#172033]">
                        {formatDate(reward.redeemedAt)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667085] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                      <span>Unlocked On</span>
                    </span>
                    <span className="font-semibold text-[#172033]">
                      {formatDate(reward.unlockedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667085]">Loyalty Cycle</span>
                    <span className="font-semibold text-[#172033]">
                      Cycle {reward.cycleNumber}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#667085] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Used reward vouchers cannot be redeemed again. Continue collecting stamps on your next visit to unlock new rewards!
                </p>
              </div>
            </>
          )}

          {/* Close Action Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-5 py-3.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-sm tracking-wide transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
