import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { staffService } from '../../services/staffService';
import type { PendingVisitRequest } from '../../services/staffService';
import {
  UserCheck,
  LogOut,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  RefreshCw,
  AlertCircle,
  Loader2,
  Check,
  X,
  History,
  Store,
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

export const StaffDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Processing state per request
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  // Recent activity session log
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);

  // Single unified dashboard query (polls every 5s while active, pauses when tab is hidden)
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['staff-dashboard'],
    queryFn: () => staffService.getDashboard(),
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

      setSuccessMsg(`Approved visit for ${request.customer.name}! (${details})`);

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
      setError(err.response?.data?.error?.message || err.message || 'Approval failed');
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
      setSuccessMsg(`Rejected visit request for ${request.customer.name}.`);

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
      setError(err.response?.data?.error?.message || err.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  const displayError =
    error ||
    (queryError
      ? (queryError as any).response?.data?.error?.message ||
        (queryError as any).response?.data?.message ||
        (queryError as any).message ||
        'Failed to load dashboard data'
      : null);

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 flex flex-col font-sans selection:bg-indigo-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 sm:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">Staff Portal & Queue</h1>
            <p className="text-xs text-slate-500">Live Branch Operations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsScanModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan Reward</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{user?.role || 'STAFF'}</span>
          </span>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors border border-slate-200 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-5 sm:p-8 space-y-6">
        {/* Banner Messages */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {displayError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{displayError}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Queue Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900">Pending Visit Stamp Queue</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                {pendingRequests.length} pending
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Verify customers in-store and approve or reject stamp requests in real-time.
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Pending Requests Grid */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-xs flex flex-col items-center gap-3 shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Loading pending queue...</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-xs space-y-1">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-2.5 border border-slate-150">
                <Clock className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">No Pending Visit Requests</p>
              <p className="text-slate-400">When customers scan the branch QR code, requests will appear here automatically.</p>
            </div>
          ) : (
            pendingRequests.map((req) => {
              const isProcessing = processingId === req.id;
              return (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-slate-900">{req.customer.name}</span>
                      <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{req.customer.maskedPhone}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Store className="w-3 h-3 text-slate-400" />
                        <span>{req.branch.name}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-medium">
                        Current Stamps: {req.currentCycleVisitCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleReject(req)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Stamp</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Operational Modules: Available Rewards Redemption & Session Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Scan Customer Reward Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Reward Voucher Redemption</h3>
                    <p className="text-[11px] text-slate-500">Scan customer QR pass or enter code</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                  Ready
                </span>
              </div>

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
              <span>Instant token validation</span>
              <span>Camera + Manual fallback</span>
            </div>
          </div>

          {/* Session Activity Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-150">
                <History className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Recent Session Actions</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Recent approvals & rejections processed in this terminal.</p>

            {recentActions.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No actions processed yet in this session.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {recentActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{action.customerName}</span>
                      {action.details && <p className="text-[10px] text-slate-500">{action.details}</p>}
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          action.type === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : action.type === 'REDEEMED'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {action.type}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{action.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

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
