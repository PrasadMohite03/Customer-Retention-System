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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Staff Management
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            Create and manage branch-level staff accounts with operational visit approval permissions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Summary Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across all business branches
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{activeCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Can log in and approve visits
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inactive Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-600 mt-2">{inactiveCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Access currently suspended
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by email or branch..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Branch Filter */}
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
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
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
              }
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isStaffLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs">Loading staff accounts...</p>
          </div>
        ) : isStaffError ? (
          <div className="p-8 text-center text-red-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="text-xs font-semibold">Failed to load staff list</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {(staffError as any)?.message || 'An error occurred'}
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No staff members found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery || branchFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'Click "Add Staff Member" above to create your first staff account.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Staff Member</th>
                  <th className="py-3 px-5">Branch Assignment</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Created</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Email / User */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 font-mono text-xs">
                            {staff.email}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <ShieldCheck className="w-3 h-3 text-slate-400" />
                            <span>Staff Role</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Store className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-medium">{staff.branchName}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-5">
                      {staff.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-4 px-5 text-slate-500">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleOpenEdit(staff)}
                          title="Edit staff details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(staff)}
                          disabled={toggleStatusMutation.isPending}
                          title={staff.isActive ? 'Deactivate staff' : 'Reactivate staff'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            staff.isActive
                              ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{staff.isActive ? 'Deactivate' : 'Reactivate'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
