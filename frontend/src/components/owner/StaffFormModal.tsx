import React, { useState, useEffect } from 'react';
import type { Branch } from '../../types/branch';
import type { StaffMember } from '../../services/staffManagementService';
import { X, Loader2, UserCheck, Key, Store, Mail } from 'lucide-react';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; password?: string; branchId: string }) => Promise<void>;
  branches: Branch[];
  staffToEdit?: StaffMember | null;
  isLoading: boolean;
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  branches,
  staffToEdit,
  isLoading,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (staffToEdit) {
      setEmail(staffToEdit.email);
      setPassword('');
      setBranchId(staffToEdit.branchId);
    } else {
      setEmail('');
      setPassword('');
      setBranchId(branches.length > 0 ? branches[0].id : '');
    }
    setFormError(null);
  }, [staffToEdit, branches, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Email address is required.');
      return;
    }

    if (!staffToEdit && (!password || password.length < 8)) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (staffToEdit && password && password.length < 8) {
      setFormError('Password must be at least 8 characters long if provided.');
      return;
    }

    if (!branchId) {
      setFormError('Please select a branch assignment.');
      return;
    }

    try {
      await onSubmit({
        email: trimmedEmail,
        ...(password ? { password } : {}),
        branchId,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Operation failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-2xl border border-[#E5E7EB] shadow-xl max-w-md w-full overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-none duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
              <UserCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-[#172033] text-base">
                {staffToEdit ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <p className="text-xs text-[#667085]">
                {staffToEdit
                  ? 'Update staff credentials or assigned branch location.'
                  : 'Create staff credentials scoped to a branch location.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold leading-relaxed">
              {formError}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#172033] uppercase tracking-wider mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@yourbusiness.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-[#172033] uppercase tracking-wider mb-1.5">
              {staffToEdit ? 'New Password (leave blank to keep current)' : 'Password'} {!staffToEdit && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={staffToEdit ? '••••••••' : 'Minimum 8 characters'}
                required={!staffToEdit}
                minLength={8}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Branch Assignment */}
          <div>
            <label className="block text-xs font-bold text-[#172033] uppercase tracking-wider mb-1.5">
              Assigned Branch Location <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 transition-all cursor-pointer font-medium"
              >
                {branches.length === 0 ? (
                  <option value="" disabled>
                    No branches available - create a branch first
                  </option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {!b.isActive ? '(Inactive)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <p className="text-[11px] text-[#667085] mt-1.5 font-medium">
              Staff members are strictly scoped to verify visit requests at this branch.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-xs font-bold text-[#667085] hover:text-[#172033] bg-[#FFFFFF] hover:bg-slate-50 border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || branches.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#172033]" />}
              <span>{staffToEdit ? 'Save Changes' : 'Create Staff Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

