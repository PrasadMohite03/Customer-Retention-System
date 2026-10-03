import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffService, type PendingVisitRequest } from '../../services/staffService';
import { branchService } from '../../services/branchService';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Phone,
  RefreshCw,
  AlertCircle,
  Loader2,
  Check,
  X,
  Store,
  Filter,
  User,
  ShieldCheck,
  Award,
  QrCode,
} from 'lucide-react';
import { RewardScannerModal } from '../../components/RewardScannerModal';

interface RecentAction {
  id: string;
  type: 'APPROVED' | 'REJECTED' | 'REDEEMED';
  customerName: string;
  time: string;
  details?: string;
}

export const OwnerVisitRequests: React.FC = () => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  // Recent session activity log
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);

  // Fetch branches for filter
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  });

  // Single unified dashboard query (polls every 5s while active, pauses when tab is hidden)
  const branchIdParam = selectedBranchId === 'ALL' ? undefined : selectedBranchId;
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['staff-dashboard', branchIdParam],
    queryFn: () => staffService.getDashboard(branchIdParam),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const pendingRequests = dashboardData?.pendingRequests ?? [];

  const handleApprove = async (request: PendingVisitRequest) => {
    setProcessingId(request.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await staffService.approveVisitRequest(request.id);
      let details = `Stamp #${result.visitNumberInCycle} recorded`;
      if (result.cycleCompleted) {
        details += ' • Cycle COMPLETED!';
      }
      if (result.newRewardUnlocked) {
        details += ` • UNLOCKED: ${result.newRewardUnlocked.rewardName || result.newRewardUnlocked.rewardType}`;
      }

      setSuccessMsg(`Approved visit for ${request.customer.name} at ${request.branch.name}! (${details})`);

      setRecentActions((prev) => [
        {
          id: `${request.id}-${Date.now()}`,
          type: 'APPROVED',
          customerName: request.customer.name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          details,
        },
        ...prev.slice(0, 9),
      ]);

      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to approve visit request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: PendingVisitRequest) => {
    setProcessingId(request.id);
    setError(null);
    setSuccessMsg(null);

    try {
      await staffService.rejectVisitRequest(request.id);
      setSuccessMsg(`Rejected visit request for ${request.customer.name}`);

      setRecentActions((prev) => [
        {
          id: `${request.id}-${Date.now()}`,
          type: 'REJECTED',
          customerName: request.customer.name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 9),
      ]);

      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const displayError =
    error ||
    (queryError
      ? (queryError as any).response?.data?.message || (queryError as any).message || 'Failed to load dashboard data'
      : null);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Visit Requests & Approvals
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            Monitor and process customer QR check-in requests in real time across all branches.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsScanModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Reward</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {displayError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{displayError}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Stat & Filter Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Requests Counter */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Queue
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{pendingRequests.length}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Awaiting owner or staff approval
          </span>
        </div>

        {/* Branch Scope */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Branch Scope
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-900 mt-3 truncate">
            {selectedBranchId === 'ALL'
              ? 'All Branches'
              : branches.find((b) => b.id === selectedBranchId)?.name || 'Filtered Branch'}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {branches.length} configured location(s)
          </span>
        </div>

        {/* Owner Permission */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Access Mode
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm font-bold text-indigo-600 mt-3">Business Owner (Global)</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Can approve visits for any branch
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">Filter by Branch:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Branches ({branches.length})</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {!b.isActive ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live sync active (refreshes every 5s)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Requests List (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span>Incoming Customer Check-Ins</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
                {pendingRequests.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400 shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
              <p className="text-xs">Loading pending requests...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No pending visit requests</p>
              <p className="text-xs text-slate-400 mt-1">
                When a customer scans a branch QR code and requests a visit stamp, it will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const isProcessing = processingId === req.id;
                const requestedDate = new Date(req.requestedAt);

                return (
                  <div
                    key={req.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Customer & Branch info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {req.customer.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {req.customer.maskedPhone}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Store className="w-3 h-3 text-indigo-500" />
                              {req.branch.name}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              {requestedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Current Cycle Stamps Badge */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-700 text-xs font-medium">
                        <Award className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          Current Cycle Stamps: <strong>{req.currentCycleVisitCount}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve Visit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Reward Redemption Terminal & Recent Session Activity */}
        <div className="space-y-6">
          {/* Scan Customer Reward Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reward Voucher Redemption</h3>
                    <p className="text-[11px] text-slate-400">Scan customer QR pass or enter code</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                  Ready
                </span>
              </div>



            {/* Scan Card Body */}
            <div className="mt-4 p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3 shadow-2xs">
                <QrCode className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Customer Presenting a Reward?</h4>
              <p className="text-xs text-slate-500 max-w-xs mb-4">
                Customers present their earned milestone reward QR or 16-character code at checkout.
              </p>

              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan Reward</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Instant tenant verification</span>
            <span>Camera + Manual fallback</span>
          </div>
        </div>


          {/* Session Activity Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>Session Activity</span>
              <span className="text-[11px] font-normal text-slate-400">Recent actions</span>
            </h3>

            {recentActions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No approvals or rejections processed in this session yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentActions.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold text-[11px] uppercase tracking-wider ${
                          act.type === 'APPROVED'
                            ? 'text-emerald-700'
                            : act.type === 'REJECTED'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {act.type}
                      </span>
                      <span className="text-[10px] text-slate-400">{act.time}</span>
                    </div>
                    <span className="font-medium text-slate-800">{act.customerName}</span>
                    {act.details && (
                      <span className="text-[11px] text-slate-500">{act.details}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reward Scanner Modal */}
      <RewardScannerModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onSuccess={() => {
          refetch();
          setSuccessMsg('Reward redemption successfully verified and recorded!');
        }}
      />
    </div>
  );
};
