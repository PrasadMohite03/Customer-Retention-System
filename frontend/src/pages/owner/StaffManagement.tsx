import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffManagementService, type StaffMember } from '../../services/staffManagementService';
import { branchService } from '../../services/branchService';
import { StaffFormModal } from '../../components/owner/StaffFormModal';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Store,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Edit2,
  Power,
  ShieldCheck,
  Filter,
} from 'lucide-react';

export const StaffManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load Staff List
  const {
    data: staffList = [],
    isLoading: isStaffLoading,
    isError: isStaffError,
    error: staffError,
  } = useQuery({
    queryKey: ['staffList'],
    queryFn: () => staffManagementService.getStaffList(),
  });

  // Load Branches (for assignment in modal and branch filter)
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  });

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (data: { email: string; password?: string; branchId: string }) =>
      staffManagementService.createStaff({
        email: data.email,
        password: data.password!,
        branchId: data.branchId,
      }),
    onSuccess: (newStaff) => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setIsModalOpen(false);
      setActionSuccess(`Staff account for "${newStaff.email}" created successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
  });

  // Update Staff Mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { email?: string; password?: string; branchId?: string };
    }) => staffManagementService.updateStaff(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setIsModalOpen(false);
      setSelectedStaff(null);
      setActionSuccess(`Staff account for "${updated.email}" updated successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
  });

  // Toggle Staff Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      staffManagementService.updateStaffStatus(id, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setActionSuccess(
        `Staff "${updated.email}" is now ${updated.isActive ? 'active' : 'deactivated'}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update staff status';
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    },
  });

  const handleOpenCreate = () => {
    setSelectedStaff(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (staff: StaffMember) => {
    toggleStatusMutation.mutate({ id: staff.id, isActive: !staff.isActive });
  };

  const handleFormSubmit = async (data: {
    email: string;
    password?: string;
    branchId: string;
  }) => {
    if (selectedStaff) {
      await updateMutation.mutateAsync({ id: selectedStaff.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  // Metrics
  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.isActive).length;
  const inactiveCount = totalCount - activeCount;

  // Filtered List
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.branchName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = branchFilter === 'ALL' || s.branchId === branchFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.isActive) ||
      (statusFilter === 'INACTIVE' && !s.isActive);
    return matchesSearch && matchesBranch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] text-[10px] font-black uppercase tracking-wider">
              <Users className="w-3 h-3 text-[#D97706]" />
              <span>Team Accounts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight">
              Staff Management
            </h1>
            <p className="text-xs sm:text-sm text-[#667085]">
              Manage staff access and visit approval permissions.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs sm:text-sm font-black rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#0E7A36] shrink-0 stroke-[2.5]" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
              Total Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#667085] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#172033] mt-2">{totalCount}</p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            Across all business branches
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0E7A36] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#55E07E]" />
              Active Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#EAFBEF] border border-[#55E07E]/30 text-[#0E7A36] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#0E7A36] mt-2">{activeCount}</p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            Can approve customer visits
          </span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Inactive Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-[#667085] flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#667085] mt-2">{inactiveCount}</p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            Access currently paused
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by email or assigned branch..."
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Branch Filter */}
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-[#667085] shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 cursor-pointer font-bold"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-[#667085] shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
              }
              className="px-3 py-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 cursor-pointer font-bold"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff List (Desktop Table / Mobile Cards) */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {isStaffLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-[#667085] space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#D97706]" />
            <p className="text-xs font-bold">Loading staff accounts...</p>
          </div>
        ) : isStaffError ? (
          <div className="p-8 text-center text-rose-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="text-xs font-bold">Failed to load staff list</p>
            <p className="text-[11px] text-[#667085] mt-1">
              {(staffError as any)?.message || 'An error occurred'}
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-[#667085]">
            <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-black text-[#172033]">No staff members found</p>
            <p className="text-xs text-[#667085] mt-1 max-w-sm mx-auto">
              {searchQuery || branchFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'Click "Add Staff Member" above to create your first staff account.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                    <th className="py-3.5 px-6">Staff Member</th>
                    <th className="py-3.5 px-6">Branch Assignment</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Created</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-xs">
                  {filteredStaff.map((staff) => (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Email / User */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 stroke-[2.2]" />
                          </div>
                          <div>
                            <p className="font-bold text-[#172033] font-mono text-xs">
                              {staff.email}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-[#667085] mt-0.5">
                              <ShieldCheck className="w-3 h-3 text-[#D97706]" />
                              <span>Staff Role</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-[#172033]">
                          <Store className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                          <span className="font-bold">{staff.branchName}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6">
                        {staff.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#55E07E]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#667085] border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-6 text-[#667085]">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                          <span>
                            {new Date(staff.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleOpenEdit(staff)}
                            title="Edit staff details"
                            className="p-2 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-slate-100 border border-[#E5E7EB] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(staff)}
                            disabled={toggleStatusMutation.isPending}
                            title={staff.isActive ? 'Deactivate staff' : 'Reactivate staff'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer min-h-[36px] ${
                              staff.isActive
                                ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                                : 'text-[#0E7A36] bg-[#EAFBEF] hover:bg-[#55E07E]/20 border-[#55E07E]/40'
                            }`}
                          >
                            <Power className="w-3 h-3 stroke-[2.2]" />
                            <span>{staff.isActive ? 'Deactivate' : 'Reactivate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Shown below 768px) */}
            <div className="block md:hidden divide-y divide-[#E5E7EB]">
              {filteredStaff.map((staff) => (
                <div key={staff.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[#172033] font-mono text-xs break-all">
                        {staff.email}
                      </p>
                      <p className="text-xs text-[#667085] flex items-center gap-1 mt-1 font-medium">
                        <Store className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                        <span>{staff.branchName}</span>
                      </p>
                    </div>

                    {staff.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#55E07E]"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#667085] border border-slate-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085] pt-1">
                    <span>Created: {new Date(staff.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(staff)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#172033] bg-[#FFFFFF] border border-[#E5E7EB] hover:bg-slate-50 min-h-[44px]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(staff)}
                      disabled={toggleStatusMutation.isPending}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border min-h-[44px] ${
                        staff.isActive
                          ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                          : 'text-[#0E7A36] bg-[#EAFBEF] hover:bg-[#55E07E]/20 border-[#55E07E]/40'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{staff.isActive ? 'Deactivate' : 'Reactivate'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Staff Modal */}
      <StaffFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStaff(null);
        }}
        onSubmit={handleFormSubmit}
        branches={branches}
        staffToEdit={selectedStaff}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

