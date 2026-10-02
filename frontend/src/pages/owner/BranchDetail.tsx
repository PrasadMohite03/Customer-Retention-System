import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Fingerprint,
  Calendar,
  Power,
  RefreshCw,
  Info,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export const BranchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();


  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleCopyToken = () => {
    if (branch) {
      navigator.clipboard.writeText(branch.qrToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const scanUrl = branch ? `${window.location.origin}/loyalty/${branch.qrToken}` : '';

  const handleCopyScanUrl = () => {
    navigator.clipboard.writeText(scanUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Branch details, operational status, and QR identification</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Edit Form & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Store className="w-4 h-4 text-indigo-600" />
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
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800"
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
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isDirty || updateMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="submit"
                  disabled={!isDirty || updateMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
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
            </form>
          </div>

          {/* System Identifiers & Auditing */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System Scopes & Timestamps
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Fingerprint className="w-3.5 h-3.5" />
                  Branch ID
                </span>
                <p className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1 select-all break-all">
                  {branch.id}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Fingerprint className="w-3.5 h-3.5" />
                  Business Tenant Scope
                </span>
                <p className="text-xs font-mono text-indigo-700 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 mt-1 select-all break-all">
                  {branch.businessId}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Created
                </span>
                <p className="text-xs text-slate-700 mt-1 font-mono">
                  {new Date(branch.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Last Updated
                </span>
                <p className="text-xs text-slate-700 mt-1 font-mono">
                  {new Date(branch.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Branch QR Identification */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Branch QR Code</h3>
                <p className="text-xs text-slate-500">Unique check-in token for customer visits</p>
              </div>
            </div>

            {/* QR Visual Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <div className="w-36 h-36 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col items-center justify-center relative">
                {/* Clean QR Visual Representation */}
                <div className="w-full h-full border-2 border-dashed border-indigo-200 rounded-lg flex flex-col items-center justify-center p-2 bg-indigo-50/20">
                  <QrCode className="w-16 h-16 text-indigo-600" />
                  <span className="text-[9px] font-semibold text-indigo-700 mt-1 uppercase tracking-wider">
                    {branch.name.slice(0, 14)}
                  </span>
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-800 mt-3">{branch.name}</span>
              <span className="text-[11px] text-slate-400">Branch Check-in Code</span>
            </div>

            {/* QR Token Value with Copy */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  QR Token String
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Token</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs font-mono text-slate-700 break-all select-all">
                  {branch.qrToken}
                </p>
              </div>
            </div>

            {/* Scan URL preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Customer Scan Link
                </span>
                <button
                  type="button"
                  onClick={handleCopyScanUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <p className="text-xs font-mono text-slate-600 break-all select-all">
                  {scanUrl}
                </p>
              </div>
            </div>

            {/* Architectural Resolution Diagram */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>Resolution Pipeline</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60">
                <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                  <span>1. QR Token</span>
                  <span className="text-slate-400">→</span>
                  <span className="truncate">{branch.qrToken.slice(0, 10)}...</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span>2. Branch</span>
                  <span className="text-slate-400">→</span>
                  <span className="truncate">{branch.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                  <span>3. Program</span>
                  <span className="text-slate-400">→</span>
                  <Link
                    to={`/owner/branches/${id}/loyalty-program`}
                    className="text-indigo-600 hover:underline truncate"
                  >
                    Manage Loyalty Program
                  </Link>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                When scanned by a customer, this QR token resolves directly to this branch and its active loyalty program.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loyalty Program Navigation Card */}
      <Link
        to={`/owner/branches/${id}/loyalty-program`}
        className="group flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 hover:shadow-md hover:border-indigo-300 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Loyalty Program</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure milestones, rewards, and cycle length for this branch
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </Link>
    </div>
  );
};
