import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService } from '../../services/branchService';
import {
  Plus,
  Search,
  MapPin,
  QrCode,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Store,
  Power,
} from 'lucide-react';

export const BranchList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: branches = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; address?: string | null }) =>
      branchService.createBranch(payload),
    onSuccess: (newBranch) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      setIsCreateModalOpen(false);
      setNewBranchName('');
      setNewBranchAddress('');
      setCreateError(null);
      setActionSuccess(`Location "${newBranch.name}" created successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create location';
      setCreateError(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      branchService.updateBranchStatus(id, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setActionSuccess(
        `Location "${updated.name}" is now ${updated.isActive ? 'active' : 'inactive'}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update location status';
      setActionSuccess(msg);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newBranchName.trim()) {
      setCreateError('Location name is required');
      return;
    }

    createMutation.mutate({
      name: newBranchName.trim(),
      address: newBranchAddress.trim() ? newBranchAddress.trim() : null,
    });
  };

  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.address && branch.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      branch.qrToken.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'ACTIVE') return matchesSearch && branch.isActive;
    if (filterStatus === 'INACTIVE') return matchesSearch && !branch.isActive;
    return matchesSearch;
  });

  const activeCount = branches.filter((b) => b.isActive).length;
  const inactiveCount = branches.filter((b) => !b.isActive).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 text-[#D97706] animate-spin" />
        <p className="text-xs text-[#667085] font-bold">Loading locations...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-[#FFFFFF] border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto shadow-xs">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-black text-[#172033]">Failed to load locations</h3>
        <p className="text-xs text-rose-600 mt-1">{(error as Error)?.message || 'An error occurred'}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] text-[10px] font-black uppercase tracking-wider">
              <Store className="w-3 h-3 text-[#D97706]" />
              <span>Locations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight">
              Locations & Check-in
            </h1>
            <p className="text-xs sm:text-sm text-[#667085]">
              Manage physical locations, standees, and customer check-in QR codes.
            </p>
          </div>

          <button
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] transition-all shadow-xs active:scale-[0.98] cursor-pointer self-start sm:self-auto min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs sm:text-sm font-bold rounded-2xl p-4 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#0E7A36] shrink-0 stroke-[2.5]" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Locations: Full-width prominent card on mobile, 1 col on desktop */}
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`col-span-2 sm:col-span-1 bg-[#FFFFFF] border p-4 sm:p-5 rounded-2xl shadow-xs cursor-pointer transition-all active:scale-[0.99] ${
            filterStatus === 'ALL'
              ? 'border-[#FFE08A] ring-2 ring-[#FFD444]/20'
              : 'border-[#E5E7EB] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">Total Locations</span>
            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#667085] flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#172033] mt-2">{branches.length}</p>
          <span className="text-[11px] text-[#667085] mt-0.5 block">Physical outlets registered</span>
        </div>

        {/* Active: Compact half-width card on mobile, 1 col on desktop */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`col-span-1 bg-[#FFFFFF] border p-3.5 sm:p-5 rounded-2xl shadow-xs cursor-pointer transition-all active:scale-[0.99] ${
            filterStatus === 'ACTIVE'
              ? 'border-[#55E07E] ring-2 ring-[#55E07E]/20 bg-[#F6FDF8]'
              : 'border-[#E5E7EB] hover:border-[#55E07E]/40'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-[#0E7A36] uppercase tracking-wider flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-[#55E07E] shrink-0" />
              Active
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EAFBEF] border border-[#55E07E]/30 text-[#0E7A36] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0E7A36] mt-1.5 sm:mt-2">{activeCount}</p>
          <span className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 block truncate">
            <span className="sm:hidden">Live QR check-in</span>
            <span className="hidden sm:inline">Live QR check-in available</span>
          </span>
        </div>

        {/* Inactive: Compact half-width card on mobile, 1 col on desktop */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'INACTIVE' ? 'ALL' : 'INACTIVE')}
          className={`col-span-1 bg-[#FFFFFF] border p-3.5 sm:p-5 rounded-2xl shadow-xs cursor-pointer transition-all active:scale-[0.99] ${
            filterStatus === 'INACTIVE'
              ? 'border-slate-400 ring-2 ring-slate-300/40 bg-slate-50'
              : 'border-[#E5E7EB] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              Inactive
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#667085] flex items-center justify-center shrink-0">
              <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#667085] mt-1.5 sm:mt-2">{inactiveCount}</p>
          <span className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 block truncate">Check-ins paused</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by location name or address..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto max-w-full pb-0.5 no-scrollbar">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'ALL'
                ? 'bg-[#FFF8E1] text-[#92400E] border border-[#FFE08A]'
                : 'text-[#667085] hover:text-[#172033] hover:bg-slate-100 border border-transparent'
            }`}
          >
            All ({branches.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'ACTIVE'
                ? 'bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/40'
                : 'text-[#667085] hover:text-[#172033] hover:bg-slate-100 border border-transparent'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('INACTIVE')}
            className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === 'INACTIVE'
                ? 'bg-slate-100 text-[#172033] border border-slate-300'
                : 'text-[#667085] hover:text-[#172033] hover:bg-slate-100 border border-transparent'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-10 sm:p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center mx-auto mb-3">
            <Store className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h3 className="text-base font-black text-[#172033]">
            {branches.length === 0 ? 'No locations created yet' : 'No locations match your filter'}
          </h3>
          <p className="text-xs sm:text-sm text-[#667085] mt-1 max-w-sm mx-auto">
            {branches.length === 0
              ? 'Add your first location to generate its customer QR standee and start accepting check-ins.'
              : 'Try changing your search terms or filter selection.'}
          </p>
          {branches.length === 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add First Location</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className={`bg-[#FFFFFF] border rounded-2xl p-5 sm:p-6 shadow-xs transition-all flex flex-col justify-between ${
                branch.isActive ? 'border-[#E5E7EB] hover:border-[#FFD444]' : 'border-[#E5E7EB]/80 bg-[#F8FAFC] opacity-90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-[#172033] leading-snug break-words">
                      {branch.name}
                    </h3>
                    <p className="text-xs text-[#667085] flex items-start gap-1.5 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#667085] shrink-0 mt-0.5" />
                      <span className="break-words">{branch.address || 'No physical address provided'}</span>
                    </p>
                  </div>

                  {branch.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#55E07E]" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-[#667085] border border-slate-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}
                </div>

                {/* QR Code Status Indicator */}
                <div className="mt-4 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#D97706]" />
                    <span className="font-bold text-[#172033]">Standee QR Ready</span>
                  </div>
                  <span className="text-[11px] text-[#667085] font-medium">Customer check-in enabled</span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    toggleStatusMutation.mutate({
                      id: branch.id,
                      isActive: !branch.isActive,
                    })
                  }
                  disabled={toggleStatusMutation.isPending}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors cursor-pointer min-h-[40px] flex items-center ${
                    branch.isActive
                      ? 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
                      : 'border-[#55E07E]/40 text-[#0E7A36] bg-[#EAFBEF] hover:bg-[#55E07E]/20'
                  }`}
                >
                  {branch.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <Link
                  to={`/owner/branches/${branch.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl bg-[#FFF8E1] hover:bg-[#FFD444] text-[#92400E] hover:text-[#172033] border border-[#FFE08A] transition-all min-h-[40px]"
                >
                  <span>Manage Location & QR</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Branch Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in slide-in-from-bottom sm:slide-in-from-none duration-200">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
                  <Store className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#172033]">Add New Location</h3>
                  <p className="text-xs text-[#667085]">Create a location and generate its customer QR standee.</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#667085] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Location Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. Katraj Branch, Downtown Store"
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] placeholder:text-slate-400 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Physical Address
                </label>
                <textarea
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  placeholder="e.g. Maratha Society, Mohan Nagar, Dhankawadi"
                  rows={2}
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] placeholder:text-slate-400 resize-none font-medium"
                />
              </div>

              <div className="bg-[#FFF8E1] border border-[#FFE08A] rounded-xl p-3 flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-[#D97706] shrink-0" />
                <p className="text-[11px] text-[#92400E] font-medium leading-relaxed">
                  A unique customer check-in QR and printable standee will be generated automatically.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createMutation.isPending}
                  className="px-4 py-2.5 text-xs font-bold text-[#667085] hover:text-[#172033] bg-[#FFFFFF] hover:bg-slate-50 border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer min-h-[40px]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98] min-h-[40px]"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#172033]" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Create Location</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
