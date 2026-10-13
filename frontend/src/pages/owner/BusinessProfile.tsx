import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessService } from '../../services/businessService';
import {
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  RefreshCw,
  X,
  Save,
  Store,
  Coffee,
  Scissors,
  Dumbbell,
  Car,
  Utensils,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';

export const BusinessProfile: React.FC = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const {
    data: business,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['business'],
    queryFn: async () => {
      const data = await businessService.getBusiness();
      setName(data.name);
      setType(data.type || '');
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; type?: string | null }) =>
      businessService.updateBusiness(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['business'], updated);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      setIsEditing(false);
      setSuccessMessage('Business profile updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update business profile';
      setFormError(msg);
    },
  });

  const handleStartEdit = () => {
    if (business) {
      setName(business.name);
      setType(business.type || '');
    }
    setFormError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (business) {
      setName(business.name);
      setType(business.type || '');
    }
    setFormError(null);
    setIsEditing(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Business name cannot be empty');
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      type: type.trim() ? type.trim() : null,
    });
  };

  const handleCopyId = () => {
    if (!business?.id) return;
    navigator.clipboard.writeText(business.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getCategoryIcon = (categoryType?: string | null) => {
    if (!categoryType) return <Store className="w-5 h-5 stroke-[2.2]" />;
    const normalized = categoryType.toUpperCase();
    if (normalized.includes('CAFE') || normalized.includes('COFFEE')) {
      return <Coffee className="w-5 h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('RESTAURANT') || normalized.includes('DINING') || normalized.includes('FOOD')) {
      return <Utensils className="w-5 h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('SALON') || normalized.includes('BEAUTY') || normalized.includes('SPA') || normalized.includes('HAIR')) {
      return <Scissors className="w-5 h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('FITNESS') || normalized.includes('GYM')) {
      return <Dumbbell className="w-5 h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('CAR') || normalized.includes('AUTO')) {
      return <Car className="w-5 h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('WELLNESS')) {
      return <Sparkles className="w-5 h-5 stroke-[2.2]" />;
    }
    return <Store className="w-5 h-5 stroke-[2.2]" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 text-[#D97706] animate-spin" />
        <p className="text-xs text-[#667085] font-bold">Loading business profile...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-[#FFFFFF] border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto shadow-xs">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-black text-[#172033]">Failed to load business profile</h3>
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

  if (!business) return null;

  const branchCount = business.branchCount ?? 1;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 rounded-full bg-[#FFD444]" />
              <span className="text-[10px] sm:text-xs font-black text-[#667085] uppercase tracking-wider">
                Brand Details
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#172033] tracking-tight">
              Business Profile
            </h1>
            <p className="text-xs sm:text-sm text-[#667085]">
              Manage your business details and information.
            </p>
          </div>

          {!isEditing && (
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] transition-all shadow-xs active:scale-[0.98] cursor-pointer self-start sm:self-auto min-h-[44px]"
            >
              <Edit3 className="w-4 h-4 stroke-[2.2]" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-[#EAFBEF] border border-[#55E07E]/40 text-[#0E7A36] text-xs sm:text-sm font-bold rounded-2xl p-4 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#0E7A36] shrink-0 stroke-[2.5]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Profile Container */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        {/* Business Identity Header (Visual Focus) */}
        <div className="px-5 sm:px-7 py-4.5 sm:py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FFFDF5]">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FFD444] text-[#172033] flex items-center justify-center shrink-0 shadow-2xs">
              {getCategoryIcon(business.type)}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#172033] leading-snug truncate">
                {business.name}
              </h2>
              <span className="text-xs font-bold text-[#667085] block truncate mt-0.5">
                {business.type || 'Local Business'}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#55E07E]" />
            Active
          </span>
        </div>

        {/* View / Edit State */}
        {isEditing ? (
          <form onSubmit={handleSave} className="p-5 sm:p-7 space-y-5">
            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Salon, Blue Tokai Coffee"
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] placeholder:text-slate-400 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider block">
                  Category / Type
                </label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. Salon, Cafe, Gym, Retail, Spa"
                  className="w-full px-4 py-2.5 text-sm bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 text-[#172033] placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-[#667085] hover:text-[#172033] bg-[#FFFFFF] hover:bg-slate-50 border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-black text-[#172033] bg-[#FFD444] hover:bg-[#F4EB6C] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98] min-h-[44px]"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#172033]" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 stroke-[2.2]" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 sm:p-7 space-y-6">
            {/* Primary Business Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              {/* 1. Business Name */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] font-black text-[#667085] uppercase tracking-wider block">
                  Business Name
                </span>
                <p className="text-sm sm:text-base font-black text-[#172033] break-words">
                  {business.name}
                </p>
              </div>

              {/* 2. Category */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] font-black text-[#667085] uppercase tracking-wider block">
                  Category
                </span>
                <p className="text-sm sm:text-base font-black text-[#172033] break-words">
                  {business.type || 'Local Business'}
                </p>
              </div>

              {/* 3. Locations */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1">
                <span className="text-[10px] font-black text-[#667085] uppercase tracking-wider block">
                  Locations
                </span>
                <p className="text-sm sm:text-base font-black text-[#0E7A36]">
                  {branchCount} active {branchCount === 1 ? 'location' : 'locations'}
                </p>
              </div>
            </div>

            {/* Secondary: Business Details Section */}
            <div className="pt-2 border-t border-[#E5E7EB]">
              <span className="text-xs font-black text-[#172033] uppercase tracking-wider block mb-3">
                Business Details
              </span>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <Calendar className="w-4 h-4 text-[#667085] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                      Created On
                    </span>
                    <span className="font-bold text-[#172033]">
                      {new Date(business.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <Calendar className="w-4 h-4 text-[#667085] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                      Last Updated
                    </span>
                    <span className="font-bold text-[#172033]">
                      {new Date(business.updatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsed / De-emphasized Technical Details Section */}
            <details className="group border-t border-[#E5E7EB] pt-3">
              <summary className="text-xs font-bold text-[#667085] hover:text-[#172033] cursor-pointer flex items-center justify-between select-none py-1 min-h-[36px]">
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                  <span>Technical details</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">UUID reference</span>
              </summary>

              <div className="mt-2.5 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Tenant ID
                  </span>
                  <span className="font-mono text-[#172033] text-[11px] select-all break-all">
                    {business.id}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#172033] bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto shrink-0 min-h-[36px]"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0E7A36]" />
                      <span className="text-[#0E7A36]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#667085]" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};


