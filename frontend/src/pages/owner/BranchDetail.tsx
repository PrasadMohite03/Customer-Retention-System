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
  Sparkles,
  ChevronRight,
  Download,
  Printer,
  X,
  ExternalLink,
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
      setSuccessMessage('Branch details updated successfully.');
      setFormError(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update branch';
      setFormError(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => branchService.updateBranchStatus(id!, isActive),
    onSuccess: (updated) => {
      queryClient.setQueryData(['branch', id], updated);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setSuccessMessage(`Branch is now ${updated.isActive ? 'active' : 'inactive'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change branch status';
      setFormError(msg);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Branch name cannot be empty');
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
    downloadLink.download = `${safeBranchName || 'branch'}-loyalty-qr.png`;
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
          <title>${branch.name} - AAO Loyalty QR</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #ffffff;
              color: #172033;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 24px;
            }
            .standee {
              width: 100%;
              max-width: 440px;
              border: 2px solid #e2e8f0;
              border-radius: 28px;
              padding: 44px 32px;
              text-align: center;
              background: #ffffff;
            }
            .brand-pill {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 6px 16px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 24px;
            }
            .brand-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #FFD444;
            }
            .branch-name {
              font-size: 26px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.25;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 15px;
              font-weight: 500;
              color: #64748b;
              margin-bottom: 30px;
            }
            .qr-box {
              display: inline-block;
              background: #ffffff;
              border: 2px solid #f1f5f9;
              border-radius: 22px;
              padding: 20px;
              margin-bottom: 26px;
            }
            .qr-img {
              width: 250px;
              height: 250px;
              display: block;
            }
            .tagline {
              font-size: 17px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 6px;
            }
            .instruction {
              font-size: 13px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="standee">
            <div class="brand-pill">
              <span class="brand-dot"></span>
              AAO
            </div>
            <h1 class="branch-name">${branch.name}</h1>
            <p class="subtitle">Scan to join our loyalty program</p>
            <div class="qr-box">
              <img src="${qrDataUrl}" class="qr-img" alt="Branch Loyalty QR" />
            </div>
            <div class="tagline">Scan. Earn. Come Again.</div>
            <div class="instruction">Open your phone camera or QR scanner to check in</div>
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
        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading branch details...</p>
      </div>
    );
  }

  if (isError || !branch) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-red-900">Branch not found or inaccessible</h3>
        <p className="text-xs text-red-600 mt-1">
          {(error as Error)?.message || 'The requested branch could not be loaded.'}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            to="/owner/branches"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Branches</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
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

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/owner/branches"
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-2xs"
            title="Back to branches"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{branch.name}</h1>
              {branch.isActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Branch details, operational status, and customer check-in QR
            </p>
          </div>
        </div>

        {/* Toggle Status Button */}
        <button
          onClick={() => toggleStatusMutation.mutate(!branch.isActive)}
          disabled={toggleStatusMutation.isPending}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-colors cursor-pointer self-start sm:self-auto shadow-2xs ${
            branch.isActive
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {toggleStatusMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Power className="w-4 h-4" />
          )}
          <span>{branch.isActive ? 'Deactivate Branch' : 'Activate Branch'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl p-3.5 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Details + QR Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Branch Information Form & Details */}
        <div className="lg:col-span-6 space-y-6">
          {/* Edit Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Store className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-semibold text-slate-900">Branch Information</h2>
              </div>
              {isDirty && (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                  Unsaved changes
                </span>
              )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 text-slate-800"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Physical Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="e.g. 100 Main Street, Suite 4, Downtown"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Updated {new Date(branch.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || updateMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!isDirty || updateMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-[#FFD444] hover:bg-[#FACC15] rounded-lg transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Loyalty Program Navigation Link */}
          <Link
            to={`/owner/branches/${id}/loyalty-program`}
            className="group flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-xs transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#FFD444]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Branch Loyalty Program</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure stamps, rewards, and milestone criteria for this branch
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </Link>
        </div>

        {/* Right Column: Branch Check-in QR */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header: Title + Status */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-800 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Branch Check-in QR</h3>
                  <p className="text-xs text-slate-500">In-store counter QR for customer visits</p>
                </div>
              </div>

              {branch.isActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Inactive
                </span>
              )}
            </div>

            {/* Inactive Branch Alert */}
            {!branch.isActive && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-900">Branch is currently inactive</p>
                  <p className="text-amber-700">Customers cannot use this QR while the branch is inactive.</p>
                </div>
              </div>
            )}

            {/* Real QR Display Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col items-center justify-center">
                <QRCodeSVG
                  value={scanUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  className="w-44 h-44 sm:w-48 sm:h-48 block"
                />
              </div>

              <h4 className="text-base font-bold text-slate-900 mt-4">{branch.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Customers scan this QR to access your loyalty program.
              </p>

              {/* Action Buttons: Download + Print */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-5">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FFD444]" />
                  <span>Print QR</span>
                </button>
              </div>
            </div>

            {/* Customer Check-in Link Field with Copy */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Customer Check-in Link
                </label>
                <button
                  type="button"
                  onClick={handleCopyScanUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <p className="text-xs font-mono text-slate-700 truncate select-all flex-1">
                  {scanUrl}
                </p>
                <a
                  href={scanUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open loyalty pass"
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* How customer check-in works section */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                How customer check-in works
              </span>
              <ol className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Customer scans the QR</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Loyalty pass opens</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Customer requests a stamp</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span>Staff approves the visit</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Print Standee Preview Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Print Counter QR Standee</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Standee Preview Card */}
            <div className="p-6 bg-slate-50 flex items-center justify-center">
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-7 text-center w-full max-w-sm shadow-sm space-y-4">
                {/* Brand pill */}
                <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-[#FFD444]" />
                  AAO
                </div>

                <div>
                  <h4 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {branch.name}
                  </h4>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Scan to join our loyalty program
                  </p>
                </div>

                <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 inline-block shadow-2xs">
                  <QRCodeSVG
                    value={scanUrl}
                    size={190}
                    level="H"
                    includeMargin={false}
                    className="w-44 h-44 block"
                  />
                </div>

                <div className="pt-1">
                  <p className="text-sm font-bold text-slate-900">Collect stamps. Unlock rewards.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Open camera or QR scanner on your phone
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExecutePrint();
                  setShowPrintModal(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-slate-900 bg-[#FFD444] hover:bg-[#FACC15] rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
