import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { branchService } from '../../services/branchService';
import {
  ArrowLeft,
  Store,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  RotateCcw,
  Calendar,
  Power,
  RefreshCw,
  Download,
  Printer,
  X,
  ExternalLink,
  MapPin,
} from 'lucide-react';

export const BranchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch Location Details
  const {
    data: branch,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchService.getBranch(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setAddress(branch.address || '');
    }
  }, [branch]);

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; address?: string | null }) =>
      branchService.updateBranch(id!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['branch', id], updated);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setSuccessMessage('Location details updated successfully.');
      setFormError(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update location';
      setFormError(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => branchService.updateBranchStatus(id!, isActive),
    onSuccess: (updated) => {
      queryClient.setQueryData(['branch', id], updated);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setSuccessMessage(`Location is now ${updated.isActive ? 'active' : 'inactive'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change location status';
      setFormError(msg);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Location name cannot be empty');
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      address: address.trim() ? address.trim() : null,
    });
  };

  const handleReset = () => {
    if (branch) {
      setName(branch.name);
      setAddress(branch.address || '');
    }
    setFormError(null);
  };

  const scanUrl = branch ? `${window.location.origin}/loyalty/${branch.qrToken}` : '';

  const handleCopyScanUrl = () => {
    if (!scanUrl) return;
    navigator.clipboard.writeText(scanUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!branch) return;
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const pngUrl = canvas.toDataURL('image/png');
    const safeBranchName = branch.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const downloadLink = document.createElement('a');
    downloadLink.download = `${safeBranchName || 'location'}-loyalty-qr.png`;
    downloadLink.href = pngUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleExecutePrint = () => {
    if (!branch) return;
    const canvas = qrCanvasRef.current;
    const qrDataUrl = canvas ? canvas.toDataURL('image/png') : '';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${branch.name} - AAO Loyalty Standee</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #ffffff;
              color: #172033;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
            }
            .standee-card {
              width: 100%;
              max-width: 580px;
              border: 2.5px solid #E5E7EB;
              border-top: 10px solid #FFD444;
              border-radius: 36px;
              padding: 48px 40px 36px;
              text-align: center;
              background: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .brand-badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #FFF8E1;
              border: 1.5px solid #FFE08A;
              padding: 7px 22px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #92400E;
              text-transform: uppercase;
              margin-bottom: 20px;
            }
            .brand-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #FFD444;
              display: inline-block;
            }
            .branch-name {
              font-size: 36px;
              font-weight: 900;
              color: #172033;
              line-height: 1.2;
              letter-spacing: -0.5px;
              margin-bottom: 8px;
              word-break: break-word;
            }
            .cta-subtitle {
              font-size: 18px;
              font-weight: 700;
              color: #4B5563;
              margin-bottom: 28px;
            }
            .qr-frame {
              display: inline-block;
              background: #ffffff;
              border: 3px solid #FFD444;
              border-radius: 28px;
              padding: 24px;
              margin-bottom: 28px;
              box-shadow: 0 6px 24px rgba(255, 212, 68, 0.15);
            }
            .qr-image {
              width: 290px;
              height: 290px;
              display: block;
            }
            .reward-tagline {
              font-size: 24px;
              font-weight: 900;
              color: #172033;
              letter-spacing: -0.3px;
              margin-bottom: 8px;
            }
            .scan-instruction {
              font-size: 15px;
              font-weight: 600;
              color: #667085;
            }
            .standee-footer {
              margin-top: 28px;
              padding-top: 18px;
              border-top: 1px dashed #E5E7EB;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.5px;
              color: #9CA3AF;
              text-transform: uppercase;
            }
            .footer-dot {
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: #FFD444;
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="brand-badge">
              <span class="brand-dot"></span>
              AAO LOYALTY
            </div>
            <h1 class="branch-name">${branch.name}</h1>
            <p class="cta-subtitle">Scan to join our loyalty program</p>
            <div class="qr-frame">
              <img src="${qrDataUrl}" class="qr-image" alt="${branch.name} Loyalty QR" />
            </div>
            <div class="reward-tagline">Collect stamps. Unlock rewards.</div>
            <p class="scan-instruction">Scan with your phone camera to get started.</p>
            <div class="standee-footer">
              <span>Powered by AAO</span>
              <span class="footer-dot"></span>
              <span>Customer Loyalty</span>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 text-[#D97706] animate-spin" />
        <p className="text-xs text-[#667085] font-bold">Loading location details...</p>
      </div>
    );
  }

  if (isError || !branch) {
    return (
      <div className="bg-[#FFFFFF] border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-black text-[#172033]">Location not found or inaccessible</h3>
        <p className="text-xs text-rose-600 mt-1">
          {(error as Error)?.message || 'The requested location could not be loaded.'}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            to="/owner/branches"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] text-[#172033] hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Locations</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const isDirty = name !== branch.name || (address || '') !== (branch.address || '');

  return (
    <div className="space-y-6">
      {/* Hidden high-res canvas used for clean PNG export and printable standee */}
      <div style={{ display: 'none' }}>
        <QRCodeCanvas
          ref={qrCanvasRef}
          value={scanUrl}
          size={1024}
          level="H"
          marginSize={2}
        />
      </div>

      {/* ── TOP HEADER (Focused on Location Identity & Status) ──────── */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/owner/branches"
              className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center text-[#667085] hover:text-[#172033] hover:bg-slate-100 transition-colors shadow-2xs shrink-0"
              title="Back to locations"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight truncate">
                  {branch.name}
                </h1>
                {branch.isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#55E07E]" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#667085] border border-slate-200 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-[#667085] mt-1 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                <span className="truncate">{branch.address || 'No physical address provided'}</span>
              </p>
            </div>
          </div>

          {/* Toggle Status Button */}
          <button
            type="button"
            onClick={() => toggleStatusMutation.mutate(!branch.isActive)}
            disabled={toggleStatusMutation.isPending}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border transition-all cursor-pointer self-start sm:self-auto shadow-xs min-h-[44px] shrink-0 ${
              branch.isActive
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-[#EAFBEF] text-[#0E7A36] border-[#55E07E]/40 hover:bg-[#55E07E]/20'
            }`}
          >
            {toggleStatusMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4 stroke-[2.2]" />
            )}
            <span>{branch.isActive ? 'Deactivate Location' : 'Activate Location'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs sm:text-sm font-bold rounded-2xl p-4 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#0E7A36] shrink-0 stroke-[2.5]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── 2 CLEAR INDEPENDENT SECTIONS (2-Column Desktop Grid) ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: 1. Location Details */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB] bg-[#FFFDF5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
                  <Store className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#172033]">Location Details</h2>
                  <p className="text-[11px] text-[#667085]">Location name and physical address</p>
                </div>
              </div>
              {isDirty && (
                <span className="text-[10px] text-[#92400E] bg-[#FFF8E1] border border-[#FFE08A] px-2.5 py-0.5 rounded-md font-bold">
                  Unsaved changes
                </span>
              )}
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Location Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Katraj Branch, Downtown Store"
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Physical Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={4}
                  placeholder="e.g. Shop 4, Maratha Society, Dhankawadi, Pune"
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] resize-none font-medium"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB]">
                <div className="text-[11px] text-[#667085] flex items-center gap-1.5 self-start sm:self-auto">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Updated {new Date(branch.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || updateMutation.isPending}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#667085] hover:text-[#172033] bg-[#FFFFFF] hover:bg-slate-50 border border-[#E5E7EB] rounded-xl transition-colors disabled:opacity-40 cursor-pointer min-h-[40px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!isDirty || updateMutation.isPending}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-[0.98] min-h-[40px]"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#172033]" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Save Details</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: 2. Customer Check-in */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            {/* Card Header */}
            <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
                  <QrCode className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#172033]">Customer Check-in</h3>
                  <p className="text-[11px] text-[#667085]">Counter standee QR and customer check-in link</p>
                </div>
              </div>

              {branch.isActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#55E07E]" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#667085] border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Paused
                </span>
              )}
            </div>

            {/* Inactive Alert */}
            {!branch.isActive && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Check-ins are currently paused</p>
                  <p className="text-amber-700 text-[11px]">Customers cannot check in while this location is inactive.</p>
                </div>
              </div>
            )}

            {/* QR Code Presentation Box */}
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-5 flex flex-col items-center justify-center text-center">
              <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 shadow-2xs flex flex-col items-center justify-center">
                <QRCodeSVG
                  value={scanUrl}
                  size={190}
                  level="H"
                  includeMargin={false}
                  className="w-40 h-40 sm:w-48 sm:h-48 block"
                />
              </div>

              <h4 className="text-sm sm:text-base font-black text-[#172033] mt-3.5 truncate max-w-full">
                {branch.name}
              </h4>
              <p className="text-xs text-[#667085] mt-0.5">
                Scan with any phone camera to check in & earn stamps.
              </p>

              {/* Download & Print Actions */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-4">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-[#FFFFFF] hover:bg-slate-50 text-[#172033] border border-[#E5E7EB] shadow-2xs transition-colors cursor-pointer min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-[#667085]" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-black rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px]"
                >
                  <Printer className="w-4 h-4 stroke-[2.2]" />
                  <span>Print Standee</span>
                </button>
              </div>
            </div>

            {/* Customer Check-in Link */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                  Customer Check-in Link
                </label>
                <button
                  type="button"
                  onClick={handleCopyScanUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#172033] hover:text-[#D97706] transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0E7A36]" />
                      <span className="text-[#0E7A36]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5">
                <p className="text-xs font-mono text-[#667085] truncate select-all flex-1">
                  {scanUrl}
                </p>
                <a
                  href={scanUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open customer loyalty pass"
                  className="text-[#667085] hover:text-[#172033] transition-colors p-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Simple Step-by-Step Guide */}
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-4 space-y-2">
              <span className="text-[10px] font-bold text-[#172033] uppercase tracking-wider block">
                How Customer Check-in Works
              </span>
              <ol className="space-y-1.5 text-xs text-[#667085]">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#172033] font-bold text-[10px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Customer scans counter QR with phone camera</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#172033] font-bold text-[10px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Loyalty pass opens & customer requests stamp</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#172033] font-bold text-[10px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Staff or owner approves the visit in real time</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Print Standee Preview Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-[#E5E7EB] flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
                  <Printer className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#172033]">Print Counter Standee</h3>
                  <p className="text-xs text-[#667085]">A4 printable counter QR standee preview</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-[#667085] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Standee Preview Box (Accurately mirrors A4 printable standee) */}
            <div className="p-4 sm:p-6 bg-[#F8FAFC] flex items-center justify-center overflow-y-auto flex-1">
              <div className="bg-[#FFFFFF] border-2 border-[#E5E7EB] border-t-8 border-t-[#FFD444] rounded-3xl p-6 sm:p-7 text-center w-full max-w-sm shadow-md flex flex-col items-center">
                {/* 1. AAO Branding */}
                <div className="inline-flex items-center gap-1.5 bg-[#FFF8E1] border border-[#FFE08A] px-3.5 py-1 rounded-full text-[11px] font-black text-[#92400E] tracking-wider uppercase mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#FFD444]" />
                  AAO LOYALTY
                </div>

                {/* 2. Business / Location Name */}
                <h4 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight leading-snug break-words max-w-xs">
                  {branch.name}
                </h4>

                {/* 3. Simple Scan CTA */}
                <p className="text-xs sm:text-sm font-bold text-[#4B5563] mt-1 mb-4">
                  Scan to join our loyalty program
                </p>

                {/* 4. Large QR Code */}
                <div className="bg-[#FFFFFF] border-[2.5px] border-[#FFD444] rounded-2xl p-3.5 inline-block shadow-sm mb-4">
                  <QRCodeSVG
                    value={scanUrl}
                    size={200}
                    level="H"
                    includeMargin={false}
                    className="w-44 h-44 sm:w-48 sm:h-48 block"
                  />
                </div>

                {/* 5. Short Reward Message */}
                <p className="text-sm sm:text-base font-black text-[#172033] tracking-tight">
                  Collect stamps. Unlock rewards.
                </p>

                {/* 6. Simple Instruction */}
                <p className="text-xs font-semibold text-[#667085] mt-1">
                  Scan with your phone camera to get started.
                </p>

                {/* Subtle Standee Footer */}
                <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB] w-full flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                  <span>Powered by AAO</span>
                  <span className="w-1 h-1 rounded-full bg-[#FFD444]" />
                  <span>Customer Loyalty</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 sm:px-6 py-3.5 bg-[#FFFFFF] border-t border-[#E5E7EB] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-bold text-[#667085] hover:text-[#172033] bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExecutePrint();
                  setShowPrintModal(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl shadow-xs transition-all cursor-pointer active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 stroke-[2.2]" />
                <span>Print Standee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
