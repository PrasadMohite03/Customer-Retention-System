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
    <div className="space-y-5 sm:space-y-6">
      {/* ── 1. HEADER (Focused Operational Header) ───────── */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight">
              Visit Requests
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
              Review customer visits and rewards.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs sm:text-sm font-black rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer min-h-[44px]"
            >
              <QrCode className="w-4 h-4 stroke-[2.2]" />
              <span>Scan Reward</span>
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh requests"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 bg-[#FFFFFF] hover:bg-slate-50 text-[#667085] hover:text-[#172033] text-xs font-bold border border-[#E5E7EB] rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#D97706]' : 'text-[#667085]'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs sm:text-sm font-bold flex items-center justify-between gap-2.5 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#0E7A36] shrink-0 stroke-[2.5]" />
            <span className="truncate">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#0E7A36] hover:opacity-80 p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {displayError && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-center justify-between gap-2.5 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="truncate">{displayError}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:opacity-80 p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Operational Layout: Customer Visits (Primary) + Side Panel (Reward Redemption & Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* ── 2. CUSTOMER VISITS (Primary / Wider Section) ───────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Section Header with Branch Filter & Live Indicator */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-base font-black text-[#172033] flex items-center gap-2">
                <span>Customer Visits</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${
                  pendingRequests.length > 0 ? 'bg-[#FFD444] text-[#172033]' : 'bg-slate-100 text-[#667085]'
                }`}>
                  {pendingRequests.length}
                </span>
              </h2>

              <div className="flex items-center gap-1.5 text-[11px] text-[#667085] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#55E07E] animate-pulse"></span>
                <span className="hidden sm:inline font-medium">Live sync active</span>
              </div>
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto min-w-0">
              <Filter className="w-3.5 h-3.5 text-[#667085] shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 cursor-pointer font-bold max-w-full truncate"
              >
                <option value="ALL">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {!b.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pending Requests List / Compact Empty State */}
          {isLoading ? (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-8 flex flex-col items-center justify-center text-[#667085] shadow-xs space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#D97706]" />
              <p className="text-xs font-bold">Checking incoming requests...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 text-center text-[#667085] shadow-xs">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-[#55E07E]" />
              <h3 className="text-sm font-black text-[#172033]">No visits waiting</h3>
              <p className="text-xs text-[#667085] mt-0.5">
                New customer check-ins will appear here.
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
                    className="bg-[#FFFFFF] border-2 border-[#FFD444] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                  >
                    {/* Left: Customer & Branch info */}
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-[#172033]">
                              {req.customer.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#667085] bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E5E7EB]">
                              <Phone className="w-3 h-3 text-[#667085]" />
                              {req.customer.maskedPhone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#667085] mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-bold text-[#172033]">
                              <Store className="w-3.5 h-3.5 text-[#D97706]" />
                              {req.branch.name}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-[#667085]">
                              <Clock className="w-3.5 h-3.5" />
                              {requestedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Current Cycle Stamps Badge */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] text-xs font-bold">
                        <Award className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>
                          Current Cycle Stamps: <strong>{req.currentCycleVisitCount}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleReject(req)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3.5 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(req)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#172033]" />
                        ) : (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>Approve Stamp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 3. SECONDARY PANEL (Reward Redemption & Session Activity) ───────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-5">
          {/* Compact Reward Redemption Card */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#172033]">Reward Redemption</h3>
                  <p className="text-xs text-[#667085]">Scan a customer's reward QR to redeem it.</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#EAFBEF] text-[#0E7A36] rounded-full border border-[#55E07E]/30 shrink-0">
                Ready
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="w-full py-2.5 px-4 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px]"
            >
              <QrCode className="w-4 h-4 stroke-[2.2]" />
              <span>Scan Reward</span>
            </button>
          </div>

          {/* Compact Session Activity Card */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#667085] uppercase tracking-wider">
                Session Activity
              </h3>
              <span className="text-[11px] text-[#667085]">
                {recentActions.length} {recentActions.length === 1 ? 'action' : 'actions'}
              </span>
            </div>

            {recentActions.length === 0 ? (
              <p className="text-xs text-[#667085] text-center py-3">
                No actions in this session yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {recentActions.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-xs flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          act.type === 'APPROVED'
                            ? 'text-[#0E7A36] bg-[#EAFBEF] border-[#55E07E]/30'
                            : act.type === 'REJECTED'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-[#92400E] bg-[#FFF8E1] border-[#FFE08A]'
                        }`}
                      >
                        {act.type}
                      </span>
                      <span className="text-[10px] text-[#667085] font-mono">{act.time}</span>
                    </div>
                    <span className="font-bold text-[#172033] mt-0.5">{act.customerName}</span>
                    {act.details && (
                      <span className="text-[11px] text-[#667085]">{act.details}</span>
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

