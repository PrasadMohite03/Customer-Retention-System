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
} from 'lucide-react';
import { staffService } from '../services/staffService';
import type { ValidatedRewardTokenInfo, RedeemedRewardTokenResult } from '../services/staffService';

interface RewardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'SCAN' | 'VALIDATING' | 'CONFIRM' | 'REDEEMING' | 'SUCCESS' | 'ERROR';

export const RewardScannerModal: React.FC<RewardScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('SCAN');
  const [mode, setMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualToken, setManualToken] = useState<string>('');
  const [activeToken, setActiveToken] = useState<string>('');
  const [validatedReward, setValidatedReward] = useState<ValidatedRewardTokenInfo | null>(null);
  const [redeemedResult, setRedeemedResult] = useState<RedeemedRewardTokenResult | null>(null);
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
      setActiveToken(token);
      setStep('VALIDATING');
      setErrorMessage(null);

      try {
        const rewardInfo = await staffService.validateRewardToken(token.trim());
        setValidatedReward(rewardInfo);
        setStep('CONFIRM');
      } catch (err: any) {
        const msg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to validate reward token';
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
      setValidatedReward(null);
      setRedeemedResult(null);
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
      const result = await staffService.redeemRewardByToken(activeToken.trim());
      setRedeemedResult(result);
      setStep('SUCCESS');
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to redeem reward';
      setErrorMessage(msg);
      setStep('ERROR');
    }
  };

  const handleReset = () => {
    setStep('SCAN');
    setManualToken('');
    setActiveToken('');
    setValidatedReward(null);
    setRedeemedResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Scan Customer Reward</h3>
              <p className="text-[11px] text-slate-400">Validate and redeem reward token</p>
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
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'CAMERA'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'MANUAL'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Point camera at customer's reward QR code
                </p>
                {cameraError && (
                  <p className="text-xs text-rose-600 mt-2 text-center bg-rose-50 p-2 rounded-lg border border-rose-200">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reward Redemption Code
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value.toUpperCase())}
                    placeholder="RP-XXXX-XXXX-XXXX"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white uppercase"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter the 16-character code shown on customer's phone
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Validating reward token...</p>
            <p className="text-xs text-slate-400">Verifying status and business authorization</p>
          </div>
        )}

        {/* ─── STEP 3: CONFIRMATION UI ─────────────────────────────────── */}
        {step === 'CONFIRM' && validatedReward && (
          <div className="py-4 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-md mb-2">
                VALID REWARD
              </span>
              <h4 className="text-base font-bold text-slate-900">{validatedReward.rewardName}</h4>
              {validatedReward.rewardDescription && (
                <p className="text-xs text-slate-600 mt-0.5">{validatedReward.rewardDescription}</p>
              )}
              {validatedReward.rewardValue && (
                <p className="text-xs font-bold text-emerald-700 mt-1">
                  Value: ${validatedReward.rewardValue}
                </p>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer:</span>
                </span>
                <span className="font-semibold text-slate-800">{validatedReward.customerName}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone:</span>
                </span>
                <span className="font-mono text-slate-800">{validatedReward.customerPhone}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Unlocked:</span>
                </span>
                <span className="text-slate-800">
                  {new Date(validatedReward.unlockedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Confirm only after applying the reward discount to customer's bill.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Redemption</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: REDEEMING ───────────────────────────────────────── */}
        {step === 'REDEEMING' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">Redeeming reward...</p>
            <p className="text-xs text-slate-400">Recording operational redemption atomically</p>
          </div>
        )}

        {/* ─── STEP 5: SUCCESS ─────────────────────────────────────────── */}
        {step === 'SUCCESS' && redeemedResult && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900">Reward Redeemed!</h4>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {redeemedResult.rewardName}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Redemption successfully recorded at{' '}
                {new Date(redeemedResult.redeemedAt).toLocaleTimeString()}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* ─── STEP 6: ERROR ───────────────────────────────────────────── */}
        {step === 'ERROR' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900">Redemption Failed</h4>
              <p className="text-xs text-rose-600 mt-1 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {errorMessage || 'An error occurred during redemption'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
