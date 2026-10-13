import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  User,
  Phone,
  Calendar,
  Gift,
} from 'lucide-react';
import { staffService } from '../services/staffService';
import type {
  ValidatedRewardTokenInfo,
  RedeemedRewardTokenResult,
  ValidatedRewardClaimInfo,
  ConfirmedRewardClaimResult,
} from '../services/staffService';

interface RewardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'SCAN' | 'VALIDATING' | 'CONFIRM' | 'REDEEMING' | 'SUCCESS' | 'ERROR';
type TokenType = 'REWARD' | 'CLAIM';

export const RewardScannerModal: React.FC<RewardScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('SCAN');
  const [mode, setMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualToken, setManualToken] = useState<string>('');
  const [activeToken, setActiveToken] = useState<string>('');
  const [tokenType, setTokenType] = useState<TokenType>('REWARD');
  const [validatedReward, setValidatedReward] = useState<ValidatedRewardTokenInfo | null>(null);
  const [redeemedResult, setRedeemedResult] = useState<RedeemedRewardTokenResult | null>(null);
  const [validatedClaim, setValidatedClaim] = useState<ValidatedRewardClaimInfo | null>(null);
  const [confirmedClaim, setConfirmedClaim] = useState<ConfirmedRewardClaimResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef<boolean>(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScannerRunningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('[Scanner] Stop warning:', err);
      } finally {
        isScannerRunningRef.current = false;
      }
    }
  }, []);

  const handleValidateToken = useCallback(
    async (token: string) => {
      await stopScanner();
      const trimmed = token.trim().toUpperCase();
      setActiveToken(trimmed);
      setStep('VALIDATING');
      setErrorMessage(null);

      try {
        if (trimmed.startsWith('RC-')) {
          setTokenType('CLAIM');
          const claimInfo = await staffService.validateRewardClaim(trimmed);
          setValidatedClaim(claimInfo);
          setStep('CONFIRM');
        } else {
          setTokenType('REWARD');
          const rewardInfo = await staffService.validateRewardToken(trimmed);
          setValidatedReward(rewardInfo);
          setStep('CONFIRM');
        }
      } catch (err: any) {
        const msg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to validate token';
        setErrorMessage(msg);
        setStep('ERROR');
      }
    },
    [stopScanner]
  );

  // Initialize camera scanner when in SCAN step and CAMERA mode
  useEffect(() => {
    if (!isOpen || step !== 'SCAN' || mode !== 'CAMERA') {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scannerId = 'reward-qr-reader';

    const startScanner = async () => {
      try {
        setCameraError(null);
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(scannerId);
        }

        if (!isScannerRunningRef.current) {
          await scannerRef.current.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              if (isMounted && decodedText) {
                handleValidateToken(decodedText);
              }
            },
            () => {
              // Ignore frame-by-frame scan misses
            }
          );
          isScannerRunningRef.current = true;
        }
      } catch (err: any) {
        console.error('[Scanner] Failed to start camera:', err);
        if (isMounted) {
          setCameraError(
            err.message || 'Unable to access camera. Please allow permissions or use manual code entry.'
          );
          setMode('MANUAL');
        }
      }
    };

    // Small delay to ensure DOM element is ready
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, step, mode, handleValidateToken, stopScanner]);

  // Clean up on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setStep('SCAN');
      setMode('CAMERA');
      setManualToken('');
      setActiveToken('');
      setTokenType('REWARD');
      setValidatedReward(null);
      setRedeemedResult(null);
      setValidatedClaim(null);
      setConfirmedClaim(null);
      setErrorMessage(null);
      setCameraError(null);
    }
  }, [isOpen, stopScanner]);

  if (!isOpen) return null;

  const handleConfirmRedeem = async () => {
    if (!activeToken) return;
    setStep('REDEEMING');
    setErrorMessage(null);

    try {
      if (tokenType === 'CLAIM') {
        const result = await staffService.confirmRewardClaim(activeToken.trim());
        setConfirmedClaim(result);
        setStep('SUCCESS');
        onSuccess();
      } else {
        const result = await staffService.redeemRewardByToken(activeToken.trim());
        setRedeemedResult(result);
        setStep('SUCCESS');
        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to process transaction';
      setErrorMessage(msg);
      setStep('ERROR');
    }
  };

  const handleReset = () => {
    setStep('SCAN');
    setManualToken('');
    setActiveToken('');
    setTokenType('REWARD');
    setValidatedReward(null);
    setRedeemedResult(null);
    setValidatedClaim(null);
    setConfirmedClaim(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col overflow-hidden max-h-[90vh] sm:max-h-none overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] text-[#172033] flex items-center justify-center border border-[#FFE08A]">
              <QrCode className="w-5 h-5 text-[#172033]" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#172033]">Scan Customer Reward</h3>
              <p className="text-[11px] text-[#667085]">Validate and redeem reward token</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── STEP 1: SCAN OR MANUAL ENTRY ────────────────────────────── */}
        {step === 'SCAN' && (
          <div className="py-4 space-y-4">
            {/* Mode Selector */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('CAMERA')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'CAMERA'
                    ? 'bg-white text-[#172033] shadow-xs'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setMode('MANUAL');
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'MANUAL'
                    ? 'bg-white text-[#172033] shadow-xs'
                    : 'text-[#667085] hover:text-[#172033]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Manual Code Entry</span>
              </button>
            </div>

            {mode === 'CAMERA' ? (
              <div className="flex flex-col items-center">
                <div className="w-full relative rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center aspect-square max-h-64 border border-slate-200">
                  <div id="reward-qr-reader" className="w-full h-full" />
                </div>
                <p className="text-xs text-[#667085] mt-2 text-center">
                  Point camera at customer's reward QR code
                </p>
                {cameraError && (
                  <p className="text-xs text-rose-600 mt-2 text-center bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {cameraError}
                  </p>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken.trim()) {
                    handleValidateToken(manualToken.trim());
                  }
                }}
                className="space-y-3 pt-2"
              >
                <div>
                  <label className="block text-xs font-bold text-[#172033] mb-1">
                    Redemption or Claim Code
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value.toUpperCase())}
                    placeholder="RC-XXXX-... or RP-XXXX-..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-[#E5E7EB] rounded-xl text-sm font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-[#FFD444] focus:bg-white uppercase text-[#172033]"
                    autoFocus
                  />
                  <p className="text-[11px] text-[#667085] mt-1">
                    Enter the code shown on customer's phone (starts with RC- or RP-)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="w-full py-3 bg-[#FFD444] hover:bg-[#F4EB6C] disabled:opacity-50 text-[#172033] rounded-xl text-xs font-black transition-colors cursor-pointer shadow-xs"
                >
                  Validate Code
                </button>
              </form>
            )}
          </div>
        )}

        {/* ─── STEP 2: VALIDATING ──────────────────────────────────────── */}
        {step === 'VALIDATING' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#172033] animate-spin" />
            <p className="text-sm font-bold text-[#172033]">Validating token...</p>
            <p className="text-xs text-[#667085]">Verifying customer status and branch authorization</p>
          </div>
        )}

        {/* ─── STEP 3: CONFIRMATION UI ─────────────────────────────────── */}
        {step === 'CONFIRM' && tokenType === 'CLAIM' && validatedClaim && (
          <div className="py-4 space-y-4">
            <div className="bg-[#FFFDF5] border border-[#FFE08A] rounded-2xl p-4 text-center">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#FFD444] text-[#172033] rounded-md mb-1.5">
                CLAIM REWARD VISIT
              </span>
              <h4 className="text-lg font-black text-[#172033] leading-tight">Complete Reward Visit?</h4>
              <p className="text-xs text-[#667085] mt-1">
                One-step visit recording and immediate reward redemption.
              </p>
            </div>

            <div className="bg-slate-50 border border-[#E5E7EB] rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#667085]">
                <span className="flex items-center gap-1.5 text-[#667085] font-medium">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer:</span>
                </span>
                <span className="font-bold text-[#172033] text-sm">{validatedClaim.customerName}</span>
              </div>

              <div className="flex items-center justify-between text-[#667085]">
                <span className="flex items-center gap-1.5 text-[#667085] font-medium">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone:</span>
                </span>
                <span className="font-mono text-[#172033]">{validatedClaim.customerPhone}</span>
              </div>

              <div className="flex items-center justify-between text-[#667085] border-t border-[#E5E7EB] pt-2">
                <span className="flex items-center gap-1.5 text-[#667085] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7A36]" />
                  <span>Visit:</span>
                </span>
                <span className="font-bold text-[#172033]">
                  {validatedClaim.expectedVisitNumber} of {validatedClaim.cycleLength}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#667085] border-t border-[#E5E7EB] pt-2">
                <span className="flex items-center gap-1.5 text-[#667085] font-medium">
                  <Gift className="w-3.5 h-3.5 text-[#FFD444]" />
                  <span>Reward:</span>
                </span>
                <span className="font-bold text-[#0E7A36] text-sm">{validatedClaim.rewardName}</span>
              </div>
              {validatedClaim.rewardValue && (
                <div className="text-right text-[11px] font-semibold text-[#667085]">
                  Value: {validatedClaim.rewardValue}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#667085] text-center font-medium">
              No second scan. Staff confirmation completes the qualifying visit and redeems the reward.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#172033] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                className="flex-2 py-2.5 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#0E7A36]" />
                <span>Confirm & Redeem</span>
              </button>
            </div>
          </div>
        )}

        {step === 'CONFIRM' && tokenType === 'REWARD' && validatedReward && (
          <div className="py-4 space-y-4">
            <div className="bg-[#EAFBEF] border border-[#55E07E]/40 rounded-2xl p-4 text-center">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#55E07E] text-[#172033] rounded-md mb-2">
                VALID REWARD
              </span>
              <h4 className="text-base font-black text-[#172033]">{validatedReward.rewardName}</h4>
              {validatedReward.rewardDescription && (
                <p className="text-xs text-[#667085] mt-0.5">{validatedReward.rewardDescription}</p>
              )}
              {validatedReward.rewardValue && (
                <p className="text-xs font-bold text-[#0E7A36] mt-1">
                  Value: ${validatedReward.rewardValue}
                </p>
              )}
            </div>

            <div className="bg-slate-50 border border-[#E5E7EB] rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#667085]">
                <span className="flex items-center gap-1.5 text-[#667085]">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer:</span>
                </span>
                <span className="font-bold text-[#172033]">{validatedReward.customerName}</span>
              </div>

              <div className="flex items-center justify-between text-[#667085]">
                <span className="flex items-center gap-1.5 text-[#667085]">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone:</span>
                </span>
                <span className="font-mono text-[#172033]">{validatedReward.customerPhone}</span>
              </div>

              <div className="flex items-center justify-between text-[#667085]">
                <span className="flex items-center gap-1.5 text-[#667085]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Unlocked:</span>
                </span>
                <span className="text-[#172033]">
                  {new Date(validatedReward.unlockedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#667085] text-center">
              Confirm only after applying the reward discount to customer's bill.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#172033] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                className="flex-2 py-2.5 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#0E7A36]" />
                <span>Confirm Redemption</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: REDEEMING ───────────────────────────────────────── */}
        {step === 'REDEEMING' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#172033] animate-spin" />
            <p className="text-sm font-bold text-[#172033]">
              {tokenType === 'CLAIM' ? 'Recording visit and redeeming reward...' : 'Redeeming reward...'}
            </p>
            <p className="text-xs text-[#667085]">Recording operational redemption atomically</p>
          </div>
        )}

        {/* ─── STEP 5: SUCCESS ─────────────────────────────────────────── */}
        {step === 'SUCCESS' && tokenType === 'CLAIM' && confirmedClaim && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-black text-[#172033]">Visit & Reward Completed!</h4>
              <p className="text-sm font-bold text-[#0E7A36] mt-1">
                {confirmedClaim.reward.rewardName} redeemed
              </p>
              <p className="text-xs text-[#667085] mt-1">
                Customer: <span className="font-bold text-[#172033]">{confirmedClaim.customer.name}</span> • Visit #{confirmedClaim.visitNumberInCycle} recorded
              </p>
              {confirmedClaim.cycleCompleted && (
                <p className="text-xs font-bold text-[#172033] bg-[#FFF8E1] border border-[#FFE08A] py-1 px-3 rounded-lg inline-block mt-2">
                  🎉 Loyalty Cycle Completed!
                </p>
              )}
              <p className="text-[11px] text-[#667085] mt-2">
                Single atomic transaction complete. No second scan needed.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs font-black transition-colors cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        )}

        {step === 'SUCCESS' && tokenType === 'REWARD' && redeemedResult && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-black text-[#172033]">Reward Redeemed!</h4>
              <p className="text-xs font-bold text-[#0E7A36] mt-0.5">
                {redeemedResult.rewardName}
              </p>
              <p className="text-[11px] text-[#667085] mt-1">
                Redemption successfully recorded at{' '}
                {new Date(redeemedResult.redeemedAt).toLocaleTimeString()}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs font-black transition-colors cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        )}

        {/* ─── STEP 6: ERROR ───────────────────────────────────────────── */}
        {step === 'ERROR' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-[#172033]">Redemption Failed</h4>
              <p className="text-xs text-rose-600 mt-1 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {errorMessage || 'An error occurred during redemption'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#172033] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs font-black transition-colors cursor-pointer shadow-xs"
              >
                Scan Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
