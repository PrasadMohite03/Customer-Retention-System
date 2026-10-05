import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  Keyboard,
  AlertCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const CustomerScan: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [manualInput, setManualInput] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef<boolean>(false);

  // Helper to extract qrToken from URL or raw token
  const parseQrToken = (raw: string): string => {
    const trimmed = raw.trim();
    // Case 1: URL containing /loyalty/:qrToken
    const match = trimmed.match(/\/loyalty\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Case 2: Query param like ?qr=xyz or ?token=xyz
    try {
      const url = new URL(trimmed);
      const token = url.searchParams.get('qr') || url.searchParams.get('token');
      if (token) return token;
    } catch {
      // not a full url
    }
    // Case 3: Raw token string
    return trimmed;
  };

  const handleDetectedToken = useCallback(
    async (tokenOrUrl: string) => {
      const cleanToken = parseQrToken(tokenOrUrl);
      if (!cleanToken) return;

      // Stop camera before navigating
      if (scannerRef.current && isRunningRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.warn('Failed to stop scanner on detected token:', err);
        } finally {
          isRunningRef.current = false;
        }
      }

      navigate(`/loyalty/${cleanToken}`);
    },
    [navigate]
  );

  const stopCamera = useCallback(async () => {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop scanner:', err);
      } finally {
        isRunningRef.current = false;
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    const scannerId = 'customer-camera-stream';
    try {
      setCameraError(null);
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }

      if (!isRunningRef.current) {
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDetectedToken(decodedText);
          },
          () => {
            // frame callback ignore
          }
        );
        isRunningRef.current = true;
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(
        'Unable to access camera. Please allow camera permissions or enter the code manually.'
      );
      isRunningRef.current = false;
    }
  }, [handleDetectedToken]);

  useEffect(() => {
    if (mode === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [mode, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const token = parseQrToken(manualInput);
    navigate(`/loyalty/${token}`);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD444]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
            In-Store Scanner
          </span>
        </div>
        <h1 className="text-xl font-black tracking-tight text-[#172033]">Scan In-Store QR</h1>
        <p className="text-xs text-[#667085] mt-0.5">
          Scan the QR code at the counter or desk to stamp your loyalty pass.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setMode('CAMERA')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === 'CAMERA'
              ? 'bg-[#FFD444] text-[#172033] shadow-xs ring-1 ring-[#FFD444]'
              : 'text-[#667085] hover:text-[#172033]'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Camera Scanner</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('MANUAL')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === 'MANUAL'
              ? 'bg-[#FFD444] text-[#172033] shadow-xs ring-1 ring-[#FFD444]'
              : 'text-[#667085] hover:text-[#172033]'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Enter Code / URL</span>
        </button>
      </div>

      {/* Camera Scanner View */}
      {mode === 'CAMERA' && (
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-900 shadow-md border-4 border-[#FFFFFF] flex items-center justify-center">
            {/* Html5Qrcode video container */}
            <div id="customer-camera-stream" className="w-full h-full object-cover" />

            {/* Viewfinder crosshairs overlay with Yellow corners */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="w-full h-full border border-white/30 rounded-xl relative">
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-[#FFD444] rounded-tl" />
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-[#FFD444] rounded-tr" />
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-[#FFD444] rounded-bl" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-[#FFD444] rounded-br" />
              </div>
            </div>

            {/* Camera error prompt */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 text-white p-5 flex flex-col items-center justify-center text-center space-y-3 z-20">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCameraError(null);
                      startCamera();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#FFD444] text-[#172033] text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    onClick={() => setMode('MANUAL')}
                    className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold"
                  >
                    Enter Code
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-[#667085] mt-4 text-center max-w-xs">
            Point your camera at the AAO QR code displayed at the store counter.
          </p>
        </div>
      )}

      {/* Manual Code / Link Input View */}
      {mode === 'MANUAL' && (
        <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[#E5E7EB] shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#172033]">Enter Pass Code or Link</h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Paste the branch token or the full loyalty link from your store receipt.
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Branch Token / URL
              </label>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. qr_br1_... or https://.../loyalty/xyz"
                required
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-xs text-[#172033] placeholder-[#667085] focus:outline-none focus:ring-2 focus:ring-[#FFD444] focus:border-[#FFD444] transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="w-full py-3 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <span>Open Loyalty Pass</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>
      )}

      {/* Instruction Card */}
      <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5E7EB] shadow-xs flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#FFD444]/25 text-[#172033] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-[#172033]" />
        </div>
        <div className="text-xs">
          <p className="font-bold text-[#172033]">Scan. Earn. Come Again.</p>
          <p className="text-[#667085] mt-0.5 leading-relaxed">
            Every participating merchant has a unique QR code at their checkout register. Scan it with AAO to record your visit and request your stamp from staff!
          </p>
        </div>
      </div>
    </div>
  );
};
