import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService } from '../../services/branchService';
import { loyaltyService } from '../../services/loyaltyService';
import type {
  LoyaltyProgram as LoyaltyProgramType,
  Milestone,
  RewardType,
  RewardChangeMode,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
} from '../../types/loyalty';
import {
  Gift,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Power,
  Info,
  Sparkles,
  Store,
} from 'lucide-react';

// ─── Types & Form States ──────────────────────────────────────────────────

interface MilestoneFormState {
  visitNumber: string;
  rewardType: RewardType;
  rewardName: string;
  rewardDescription: string;
  rewardValue: string;
}

const defaultMilestoneForm: MilestoneFormState = {
  visitNumber: '',
  rewardType: 'FREE_ITEM',
  rewardName: '',
  rewardDescription: '',
  rewardValue: '',
};

// ─── Helper Functions ─────────────────────────────────────────────────────

function getRewardTypeText(type: RewardType, value?: string | null) {
  switch (type) {
    case 'PERCENT_DISCOUNT':
      return value ? `${value}% discount` : 'Discount';
    case 'FIXED_DISCOUNT':
      return value ? `₹${value} discount` : 'Discount';
    case 'FREE_ITEM':
      return 'Free item';
    default:
      return 'Special reward';
  }
}

function getRewardDisplay(milestone: Milestone) {
  let headline = milestone.rewardName || 'Reward';
  let sublabel = '';

  const visitSuffix = milestone.visitNumber === 1 ? '1 visit' : `${milestone.visitNumber} visits`;

  if (milestone.rewardType === 'FIXED_DISCOUNT') {
    headline = milestone.rewardValue ? `₹${milestone.rewardValue} OFF` : (milestone.rewardName || 'Discount');
    sublabel = `Fixed discount · After ${visitSuffix}`;
  } else if (milestone.rewardType === 'PERCENT_DISCOUNT') {
    headline = milestone.rewardValue ? `${milestone.rewardValue}% OFF` : (milestone.rewardName || 'Discount');
    sublabel = `Percent discount · After ${visitSuffix}`;
  } else if (milestone.rewardType === 'FREE_ITEM') {
    headline = milestone.rewardName || 'Free Item';
    sublabel = `Free item · After ${visitSuffix}`;
  } else {
    headline = milestone.rewardName || 'Stamp Checkpoint';
    sublabel = `Checkpoint · After ${visitSuffix}`;
  }

  return { headline, sublabel };
}

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as any).response;
    return r?.data?.message || r?.data?.error || 'An unexpected error occurred';
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

// ─── Clean Responsive Journey Component ───────────────────────────────────

interface JourneyPreviewProps {
  cycleLength: number;
  milestones: Milestone[];
}

const JourneyPreview: React.FC<JourneyPreviewProps> = ({ cycleLength, milestones }) => {
  const milestoneMap = new Map(milestones.map((m) => [m.visitNumber, m]));
  const safeLength = Math.max(1, cycleLength || 1);
  const visits = Array.from({ length: safeLength }, (_, i) => i + 1);
  const isCompact = safeLength > 6;

  return (
    <div className="w-full pt-2 pb-1 overflow-x-auto">
      <div className="flex items-center justify-between w-full min-w-0">
        {visits.map((visit, idx) => {
          const milestone = milestoneMap.get(visit);
          const isReward = !!milestone && milestone.isEnabled;
          const isLast = idx === safeLength - 1;

          return (
            <React.Fragment key={visit}>
              {/* Individual Step */}
              <div className="flex flex-col items-center min-w-0 flex-shrink-0 text-center">
                {/* Stamp Circle: Number for regular visit, Gift icon for reward */}
                <div
                  className={`rounded-2xl flex items-center justify-center font-black transition-all ${
                    isCompact
                      ? 'w-8 h-8 sm:w-11 sm:h-11'
                      : 'w-10 h-10 sm:w-12 sm:h-12'
                  } ${
                    isReward
                      ? 'bg-[#FFD444] text-[#172033] border border-[#FFE08A] shadow-xs'
                      : 'bg-[#FFFFFF] border-2 border-[#E5E7EB] text-[#667085]'
                  }`}
                >
                  {isReward ? (
                    <Gift className={`${isCompact ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} stroke-[2.3] text-[#172033]`} />
                  ) : (
                    <span className={`${isCompact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'} font-bold text-[#667085]`}>{visit}</span>
                  )}
                </div>

                {/* Simple Visit / Reward Label */}
                <span
                  className={`text-[10px] sm:text-xs font-bold mt-2 whitespace-nowrap ${
                    isReward ? 'text-[#D97706]' : 'text-[#172033]'
                  }`}
                >
                  {isReward ? 'Reward' : `Visit ${visit}`}
                </span>
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2.5 rounded-full transition-colors ${
                    isReward ? 'bg-[#FFD444]' : 'bg-[#E5E7EB]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Clean Reward Item (Typography & Content focused, No Badge Clutter) ────

interface RewardCardProps {
  milestone: Milestone;
  cycleLength: number;
  branchId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

const RewardCard: React.FC<RewardCardProps> = ({
  milestone,
  cycleLength,
  branchId,
  isEditing,
  onStartEdit,
  onCancelEdit,
}) => {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cannotDeleteDueToHistory, setCannotDeleteDueToHistory] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [changeMode, setChangeMode] = useState<RewardChangeMode>('NEW_CYCLES_ONLY');
  const [form, setForm] = useState<MilestoneFormState>({
    visitNumber: String(milestone.visitNumber),
    rewardType: milestone.rewardType,
    rewardName: milestone.rewardName ?? '',
    rewardDescription: milestone.rewardDescription ?? '',
    rewardValue: milestone.rewardValue ?? '',
  });

  useEffect(() => {
    if (isEditing) {
      setForm({
        visitNumber: String(milestone.visitNumber),
        rewardType: milestone.rewardType,
        rewardName: milestone.rewardName ?? '',
        rewardDescription: milestone.rewardDescription ?? '',
        rewardValue: milestone.rewardValue ?? '',
      });
      setChangeMode('NEW_CYCLES_ONLY');
      setFormError(null);
    }
  }, [isEditing, milestone]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['loyalty-programs', branchId] });
    queryClient.invalidateQueries({ queryKey: ['loyalty-program-primary'] });
  }

  const startEditing = () => {
    setFormError(null);
    setChangeMode('NEW_CYCLES_ONLY');
    setForm({
      visitNumber: String(milestone.visitNumber),
      rewardType: milestone.rewardType,
      rewardName: milestone.rewardName ?? '',
      rewardDescription: milestone.rewardDescription ?? '',
      rewardValue: milestone.rewardValue ?? '',
    });
    onStartEdit();
  };

  const cancelEditing = () => {
    setChangeMode('NEW_CYCLES_ONLY');
    setFormError(null);
    setForm({
      visitNumber: String(milestone.visitNumber),
      rewardType: milestone.rewardType,
      rewardName: milestone.rewardName ?? '',
      rewardDescription: milestone.rewardDescription ?? '',
      rewardValue: milestone.rewardValue ?? '',
    });
    onCancelEdit();
  };

  const toggleMutation = useMutation({
    mutationFn: () =>
      loyaltyService.updateMilestoneStatus(
        milestone.id,
        !milestone.isEnabled,
        !milestone.isEnabled ? 'NEW_CYCLES_ONLY' : 'STOP_REWARD'
      ),
    onSuccess: () => {
      invalidate();
      setShowDeleteConfirm(false);
      setCannotDeleteDueToHistory(false);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const disableMutation = useMutation({
    mutationFn: () => loyaltyService.updateMilestoneStatus(milestone.id, false, 'STOP_REWARD'),
    onSuccess: () => {
      invalidate();
      setShowDeleteConfirm(false);
      setCannotDeleteDueToHistory(false);
      setFormError(null);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMilestoneRequest) => loyaltyService.updateMilestone(milestone.id, payload),
    onSuccess: () => {
      invalidate();
      onCancelEdit();
      setChangeMode('NEW_CYCLES_ONLY');
      setFormError(null);
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => loyaltyService.deleteMilestone(milestone.id),
    onSuccess: () => {
      invalidate();
      setShowDeleteConfirm(false);
      setCannotDeleteDueToHistory(false);
    },
    onError: (err: any) => {
      const msg = extractError(err);
      if (
        msg.toLowerCase().includes('customer reward') ||
        msg.toLowerCase().includes('associated') ||
        msg.toLowerCase().includes('disable') ||
        err?.response?.status === 409
      ) {
        setCannotDeleteDueToHistory(true);
        setFormError(null);
      } else {
        setFormError(msg);
      }
    },
  });

  const handleSave = () => {
    const visitNum = parseInt(form.visitNumber, 10);
    if (!form.visitNumber || isNaN(visitNum) || visitNum < 1) {
      setFormError('Please enter a valid visit number');
      return;
    }
    if (visitNum > cycleLength) {
      setFormError(`Visit number cannot exceed ${cycleLength}`);
      return;
    }
    if (form.rewardType === 'PERCENT_DISCOUNT' && changeMode !== 'STOP_REWARD') {
      const val = parseFloat(form.rewardValue);
      if (!form.rewardValue || isNaN(val) || val <= 0 || val > 100) {
        setFormError('% Discount requires a value between 0 and 100');
        return;
      }
    }
    if (form.rewardType === 'FIXED_DISCOUNT' && changeMode !== 'STOP_REWARD') {
      const val = parseFloat(form.rewardValue);
      if (!form.rewardValue || isNaN(val) || val <= 0) {
        setFormError('Fixed discount requires a positive amount');
        return;
      }
    }
    if (form.rewardType === 'FREE_ITEM' && !form.rewardName.trim() && changeMode !== 'STOP_REWARD') {
      setFormError('Please enter a reward name');
      return;
    }

    const payload: UpdateMilestoneRequest = {
      visitNumber: visitNum,
      rewardType: form.rewardType,
      changeMode,
    };
    if (form.rewardType !== 'NONE') {
      payload.rewardName = form.rewardName.trim() || null;
      payload.rewardDescription = form.rewardDescription.trim() || null;
      if (form.rewardType === 'PERCENT_DISCOUNT' || form.rewardType === 'FIXED_DISCOUNT') {
        payload.rewardValue = form.rewardValue ? parseFloat(form.rewardValue) : null;
      }
    } else {
      payload.rewardName = null;
      payload.rewardValue = null;
    }

    setFormError(null);
    updateMutation.mutate(payload);
  };

  if (isEditing) {
    return (
      <div className="bg-[#FFFFFF] border-2 border-[#FFD444] rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
        <h4 className="text-xs font-black text-[#172033] uppercase tracking-wider">
          Edit Reward for Visit #{milestone.visitNumber}
        </h4>

        {formError && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#172033] uppercase mb-1">
              Visit Number
            </label>
            <input
              type="number"
              min={1}
              max={cycleLength}
              value={form.visitNumber}
              onChange={(e) => setForm({ ...form, visitNumber: e.target.value })}
              className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#172033] uppercase mb-1">
              Reward Type
            </label>
            <select
              value={form.rewardType}
              onChange={(e) =>
                setForm({
                  ...form,
                  rewardType: e.target.value as RewardType,
                  rewardValue: '',
                  rewardName: '',
                })
              }
              className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-bold cursor-pointer"
            >
              <option value="FREE_ITEM">Free Item</option>
              <option value="PERCENT_DISCOUNT">% Discount</option>
              <option value="FIXED_DISCOUNT">Fixed Discount (₹)</option>
              <option value="NONE">Stamp Checkpoint</option>
            </select>
          </div>
        </div>

        {form.rewardType !== 'NONE' && (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#172033] uppercase mb-1">
                Reward Name {form.rewardType === 'FREE_ITEM' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                placeholder="e.g. Free Coffee, 20% Off Bill"
                value={form.rewardName}
                onChange={(e) => setForm({ ...form, rewardName: e.target.value })}
                className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
              />
            </div>

            {(form.rewardType === 'PERCENT_DISCOUNT' || form.rewardType === 'FIXED_DISCOUNT') && (
              <div>
                <label className="block text-[11px] font-bold text-[#172033] uppercase mb-1">
                  Value ({form.rewardType === 'PERCENT_DISCOUNT' ? '% · max 100' : '₹ · in Rupees'})
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={form.rewardType === 'PERCENT_DISCOUNT' ? '20' : '100'}
                  value={form.rewardValue}
                  onChange={(e) => setForm({ ...form, rewardValue: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-[#172033] uppercase mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Valid on any hot beverage or haircut"
                value={form.rewardDescription}
                onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
                className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
              />
            </div>
          </div>
        )}

        {/* Change-Impact Section (Phase 2 - Refined) */}
        <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
          <label className="block text-xs font-bold text-[#172033]">
            Who should this change apply to?
          </label>

          <div className="flex flex-col gap-1.5">
            {/* Option 1: New cycles only (Default / Safest) */}
            <label
              className={`flex items-start gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                changeMode === 'NEW_CYCLES_ONLY'
                  ? 'bg-[#FFF8E1] border-[#FFD444]'
                  : 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-slate-300 hover:bg-[#F8FAFC]/60'
              }`}
            >
              <input
                type="radio"
                name={`changeMode-${milestone.id}`}
                value="NEW_CYCLES_ONLY"
                checked={changeMode === 'NEW_CYCLES_ONLY'}
                onChange={() => setChangeMode('NEW_CYCLES_ONLY')}
                className="mt-0.5 text-[#FFD444] accent-[#FFD444] focus:ring-[#FFD444]/30 h-4 w-4 border-[#D1D5DB] cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#172033] leading-snug">
                  New cycles only
                </div>
                <div className="text-[11px] text-[#667085] leading-snug mt-0.5">
                  New customers get the updated reward. Existing customers keep the current reward.
                </div>
              </div>
            </label>

            {/* Option 2: Existing + new cycles */}
            <label
              className={`flex items-start gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                changeMode === 'EXISTING_AND_NEW'
                  ? 'bg-[#FFF8E1] border-[#FFD444]'
                  : 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-slate-300 hover:bg-[#F8FAFC]/60'
              }`}
            >
              <input
                type="radio"
                name={`changeMode-${milestone.id}`}
                value="EXISTING_AND_NEW"
                checked={changeMode === 'EXISTING_AND_NEW'}
                onChange={() => setChangeMode('EXISTING_AND_NEW')}
                className="mt-0.5 text-[#FFD444] accent-[#FFD444] focus:ring-[#FFD444]/30 h-4 w-4 border-[#D1D5DB] cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#172033] leading-snug">
                  Existing + new cycles
                </div>
                <div className="text-[11px] text-[#667085] leading-snug mt-0.5">
                  The updated reward will apply to all customers.
                </div>
              </div>
            </label>

            {/* Option 3: Stop this reward */}
            <label
              className={`flex items-start gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                changeMode === 'STOP_REWARD'
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-slate-300 hover:bg-[#F8FAFC]/60'
              }`}
            >
              <input
                type="radio"
                name={`changeMode-${milestone.id}`}
                value="STOP_REWARD"
                checked={changeMode === 'STOP_REWARD'}
                onChange={() => setChangeMode('STOP_REWARD')}
                className="mt-0.5 text-rose-600 accent-rose-600 focus:ring-rose-500/30 h-4 w-4 border-[#D1D5DB] cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#172033] leading-snug">
                  Stop this reward
                </div>
                <div className="text-[11px] text-[#667085] leading-snug mt-0.5">
                  Customers can no longer earn this reward. Existing earned rewards remain safe.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Impact Confirmation / Safety Notices */}
        {changeMode === 'EXISTING_AND_NEW' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-xs text-[#172033]">
            <Info className="w-3.5 h-3.5 text-[#667085] shrink-0" />
            <span className="text-[11px] sm:text-xs">The updated reward will apply to all customers.</span>
          </div>
        )}

        {changeMode === 'STOP_REWARD' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/50 border border-rose-200 text-xs text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium">Customers can no longer earn this reward. Existing earned rewards remain safe.</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
          {changeMode === 'STOP_REWARD' ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[40px] disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5 stroke-[2.2]" />
              )}
              <span>Stop This Reward</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[40px] disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 stroke-[2.2]" />
              )}
              <span>Save Reward</span>
            </button>
          )}

          <button
            type="button"
            onClick={cancelEditing}
            className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] text-[#667085] hover:text-[#172033] text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
          >
            <X className="w-3.5 h-3.5" /> <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  const handleToggle = () => {
    setFormError(null);
    if (!milestone.isEnabled && milestone.visitNumber > cycleLength) {
      setFormError(
        `Cannot enable reward for visit ${milestone.visitNumber}: this program only has ${cycleLength} visits to complete. Increase visits to complete in Program Settings or edit this reward first.`
      );
      return;
    }
    toggleMutation.mutate();
  };

  const rewardTypeText = getRewardTypeText(milestone.rewardType, milestone.rewardValue);

  const renderActionButtons = () => (
    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggleMutation.isPending}
        title={
          !milestone.isEnabled && milestone.visitNumber > cycleLength
            ? `Cannot enable: visit #${milestone.visitNumber} exceeds cycle length (${cycleLength})`
            : milestone.isEnabled
            ? 'Disable reward'
            : 'Enable reward'
        }
        className="p-1.5 sm:p-2 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-slate-100 transition-colors cursor-pointer min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
      >
        {toggleMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#D97706]" />
        ) : milestone.isEnabled ? (
          <ToggleRight className="w-5 h-5 text-[#0E7A36]" />
        ) : (
          <ToggleLeft className={`w-5 h-5 ${milestone.visitNumber > cycleLength ? 'text-amber-500' : 'text-slate-400'}`} />
        )}
      </button>

      <button
        type="button"
        onClick={startEditing}
        title="Edit reward"
        className="p-1.5 sm:p-2 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-slate-100 transition-colors cursor-pointer min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
      >
        <Edit3 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setCannotDeleteDueToHistory(false);
          setFormError(null);
          setShowDeleteConfirm(true);
        }}
        disabled={deleteMutation.isPending || disableMutation.isPending}
        title="Delete reward"
        className="p-1.5 sm:p-2 rounded-xl text-[#667085] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          milestone.isEnabled
            ? 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-[#FFD444] shadow-xs'
            : 'bg-[#F8FAFC] border-[#E5E7EB]/80 opacity-80'
        }`}
      >
        {/* Mobile View (sm:hidden) */}
        <div className="sm:hidden flex items-start gap-3">
          {/* Reward Icon: fixed and aligned with row 1 */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              milestone.isEnabled
                ? 'bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E]'
                : 'bg-slate-100 border border-slate-200 text-slate-400'
            }`}
          >
            <Gift className="w-5 h-5 stroke-[2.2]" />
          </div>

          {/* Right Column: Row 1 (Name & Actions), Row 2 (Full Description) */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Row 1: Reward Name on left, Actions on right */}
            <div className="flex items-center justify-between gap-2 min-h-[36px]">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-[#172033] line-clamp-2 break-words leading-snug">
                  {milestone.rewardName || 'Reward'}
                </h4>
                {!milestone.isEnabled && (
                  <span className="block text-[10px] text-[#667085] font-medium leading-tight mt-0.5">
                    {milestone.visitNumber > cycleLength
                      ? `(Inactive · Exceeds ${cycleLength} visits)`
                      : '(Inactive)'}
                  </span>
                )}
              </div>

              {/* Actions only share horizontal space with the reward name */}
              {renderActionButtons()}
            </div>

            {/* Row 2: Full Description spanning full width below actions */}
            <p className="text-[13px] text-[#667085] break-words leading-relaxed">
              <span className="font-semibold text-[#172033]">After {milestone.visitNumber} visits</span>
              {' • '}
              <span>{rewardTypeText}</span>
              {milestone.rewardDescription ? ` • ${milestone.rewardDescription}` : ''}
            </p>
          </div>
        </div>

        {/* Desktop View (hidden sm:flex) - Preserved */}
        <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                milestone.isEnabled
                  ? 'bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E]'
                  : 'bg-slate-100 border border-slate-200 text-slate-400'
              }`}
            >
              <Gift className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-[#172033] truncate">
                  {milestone.rewardName || 'Reward'}
                </h4>
                {!milestone.isEnabled && (
                  <span className="text-[11px] text-[#667085] font-medium">
                    {milestone.visitNumber > cycleLength
                      ? `(Inactive · Exceeds ${cycleLength} visits)`
                      : '(Inactive)'}
                  </span>
                )}
              </div>

              <p className="text-sm text-[#667085] mt-0.5 break-words">
                <span className="font-semibold text-[#172033]">After {milestone.visitNumber} visits</span>
                {' • '}
                <span>{rewardTypeText}</span>
                {milestone.rewardDescription ? ` • ${milestone.rewardDescription}` : ''}
              </p>
            </div>
          </div>

          {renderActionButtons()}
        </div>

        {/* Error message banner if toggle/action fails */}
        {formError && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-semibold">{formError}</div>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Modern AAO Delete Reward Confirmation Modal */}
      {showDeleteConfirm && (() => {
        const { headline, sublabel } = getRewardDisplay(milestone);
        const hasCustomerHistory =
          (milestone._count?.milestoneRewards ?? 0) > 0 || cannotDeleteDueToHistory;

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() =>
              !deleteMutation.isPending &&
              !disableMutation.isPending &&
              !toggleMutation.isPending &&
              setShowDeleteConfirm(false)
            }
          >
            <div
              className="bg-[#FFFFFF] rounded-2xl max-w-sm w-full shadow-xl overflow-hidden border border-[#E5E7EB] p-5 sm:p-6 text-center animate-in zoom-in-95 duration-150 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {hasCustomerHistory ? (
                /* Proactive Safe UX: Reward has customer records */
                <>
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                    <Power className="w-5 h-5 stroke-[2.2]" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-[#172033]">
                      Disable this reward?
                    </h3>
                    <p className="text-xs sm:text-sm text-[#667085]">
                      This reward cannot be deleted because customers have already earned it.
                    </p>
                  </div>

                  {/* Reward Preview */}
                  <div className="bg-[#FFFDF5] border border-[#FFE08A] rounded-xl p-3 text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#172033] truncate">
                          {headline}
                        </p>
                        <p className="text-xs text-[#667085] truncate">
                          {sublabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#667085]">
                    Customers will no longer earn this reward, but existing rewards will remain safe.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setCannotDeleteDueToHistory(false);
                        setFormError(null);
                      }}
                      disabled={disableMutation.isPending}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#172033] hover:bg-slate-50 bg-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
                    >
                      Keep Reward
                    </button>

                    <button
                      type="button"
                      onClick={() => disableMutation.mutate()}
                      disabled={disableMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-[#FFFFFF] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px] disabled:opacity-60"
                    >
                      {disableMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Disabling...</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Disable Reward</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Standard Delete Confirmation */
                <>
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <Trash2 className="w-5 h-5 stroke-[2.2]" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-[#172033]">
                      Delete this reward?
                    </h3>
                    <p className="text-xs sm:text-sm text-[#667085]">
                      Are you sure you want to remove this reward?
                    </p>
                  </div>

                  {/* Reward Preview */}
                  <div className="bg-[#FFFDF5] border border-[#FFE08A] rounded-xl p-3 text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E] flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#172033] truncate">
                          {headline}
                        </p>
                        <p className="text-xs text-[#667085] truncate">
                          {sublabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <p className="text-xs text-[#667085]">
                    Customers will no longer be able to earn this reward.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setFormError(null);
                      }}
                      disabled={deleteMutation.isPending}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#172033] hover:bg-slate-50 bg-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
                    >
                      Keep Reward
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-[#FFFFFF] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px] disabled:opacity-60"
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Delete Reward</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
};

// ─── Main Loyalty Programs Page ───────────────────────────────────────────

export const LoyaltyPrograms: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeBranchId } = useParams<{ id: string }>();

  // Fetch all branches/locations
  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
  } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  });

  // Determine selected branch ID: route param -> searchParam -> first branch
  const queryBranchId = searchParams.get('branchId');
  const selectedBranchId =
    routeBranchId ||
    queryBranchId ||
    (branches.length > 0 ? branches[0].id : null);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0] || null;

  // Form states for creating a program
  const [createForm, setCreateForm] = useState({ name: '', description: '', cycleLength: '4' });
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for editing program settings
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', cycleLength: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Form states for adding milestone
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(defaultMilestoneForm);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);

  // Reset open forms when switching branch
  useEffect(() => {
    setShowAddMilestone(false);
    setEditingMilestoneId(null);
  }, [selectedBranchId]);

  // Fetch loyalty programs for selected branch
  const {
    data: programs,
    isLoading: isProgramsLoading,
    isError: isProgramsError,
  } = useQuery({
    queryKey: ['loyalty-programs', selectedBranchId],
    queryFn: () => loyaltyService.getLoyaltyPrograms(selectedBranchId!),
    enabled: !!selectedBranchId,
  });

  const program: LoyaltyProgramType | null = programs?.[0] ?? null;
  const hasNoProgram =
    !isProgramsLoading && !isProgramsError && programs !== undefined && programs.length === 0;

  // Sync edit form when program loads
  useEffect(() => {
    if (program) {
      setEditForm({
        name: program.name,
        description: program.description ?? '',
        cycleLength: String(program.cycleLength),
      });
    }
  }, [program?.id]);

  function invalidatePrograms() {
    if (selectedBranchId) {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-program-primary'] });
    }
  }

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: () =>
      loyaltyService.createLoyaltyProgram(selectedBranchId!, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        cycleLength: parseInt(createForm.cycleLength, 10),
      }),
    onSuccess: () => {
      invalidatePrograms();
      setCreateError(null);
    },
    onError: (err) => setCreateError(extractError(err)),
  });

  // Update Program Mutation
  const updateProgramMutation = useMutation({
    mutationFn: () =>
      loyaltyService.updateLoyaltyProgram(selectedBranchId!, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        cycleLength: parseInt(editForm.cycleLength, 10),
      }),
    onSuccess: () => {
      invalidatePrograms();
      setIsEditingProgram(false);
      setEditError(null);
      setEditSuccess('Program settings updated successfully.');
      setTimeout(() => setEditSuccess(null), 3000);
    },
    onError: (err) => setEditError(extractError(err)),
  });

  // Status Toggle Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      loyaltyService.updateLoyaltyProgramStatus(program!.id, isActive),
    onSuccess: () => {
      invalidatePrograms();
      setStatusError(null);
      setShowStatusConfirm(false);
    },
    onError: (err) => setStatusError(extractError(err)),
  });

  // Add Milestone Mutation
  const addMilestoneMutation = useMutation({
    mutationFn: (payload: CreateMilestoneRequest) =>
      loyaltyService.createMilestone(program!.id, payload),
    onSuccess: () => {
      invalidatePrograms();
      setShowAddMilestone(false);
      setMilestoneForm(defaultMilestoneForm);
      setMilestoneError(null);
    },
    onError: (err) => setMilestoneError(extractError(err)),
  });

  const handleAddMilestone = () => {
    const visitNum = parseInt(milestoneForm.visitNumber, 10);
    if (!milestoneForm.visitNumber || isNaN(visitNum) || visitNum < 1) {
      setMilestoneError('Please choose which visit unlocks this reward');
      return;
    }
    if (program && visitNum > program.cycleLength) {
      setMilestoneError(`Visit cannot exceed ${program.cycleLength}`);
      return;
    }
    if (milestoneForm.rewardType === 'PERCENT_DISCOUNT') {
      const val = parseFloat(milestoneForm.rewardValue);
      if (!milestoneForm.rewardValue || isNaN(val) || val <= 0 || val > 100) {
        setMilestoneError('% Discount requires a value between 0 and 100');
        return;
      }
    }
    if (milestoneForm.rewardType === 'FIXED_DISCOUNT') {
      const val = parseFloat(milestoneForm.rewardValue);
      if (!milestoneForm.rewardValue || isNaN(val) || val <= 0) {
        setMilestoneError('Fixed discount requires a positive amount');
        return;
      }
    }
    if (milestoneForm.rewardType === 'FREE_ITEM' && !milestoneForm.rewardName.trim()) {
      setMilestoneError('Please enter a reward name');
      return;
    }

    const payload: CreateMilestoneRequest = { visitNumber: visitNum, rewardType: milestoneForm.rewardType };
    if (milestoneForm.rewardType !== 'NONE') {
      payload.rewardName = milestoneForm.rewardName.trim() || null;
      payload.rewardDescription = milestoneForm.rewardDescription.trim() || null;
      if (milestoneForm.rewardType === 'PERCENT_DISCOUNT' || milestoneForm.rewardType === 'FIXED_DISCOUNT') {
        payload.rewardValue = milestoneForm.rewardValue ? parseFloat(milestoneForm.rewardValue) : null;
      }
    }

    setMilestoneError(null);
    addMilestoneMutation.mutate(payload);
  };

  const handleCreateProgram = () => {
    const cycleLen = parseInt(createForm.cycleLength, 10);
    if (!createForm.name.trim()) {
      setCreateError('Program name is required');
      return;
    }
    if (!createForm.cycleLength || isNaN(cycleLen) || cycleLen < 1) {
      setCreateError('Please enter a valid visit count (at least 1)');
      return;
    }
    setCreateError(null);
    createMutation.mutate();
  };

  const handleSelectBranch = (branchId: string) => {
    setSearchParams({ branchId });
  };

  if (isBranchesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#D97706]" />
        <p className="text-xs text-[#667085] font-bold">Loading loyalty programs...</p>
      </div>
    );
  }

  if (isBranchesError || branches.length === 0) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center mx-auto">
          <Store className="w-6 h-6 stroke-[2.2]" />
        </div>
        <div>
          <h3 className="text-base font-black text-[#172033]">No Locations Found</h3>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Please add a business location first before configuring customer rewards.
          </p>
        </div>
        <Link
          to="/owner/branches"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-all cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Location</span>
        </Link>
      </div>
    );
  }

  const sortedMilestones = [...(program?.milestones ?? [])].sort((a, b) => a.visitNumber - b.visitNumber);
  const usedVisitNumbers = new Set(sortedMilestones.map((m) => m.visitNumber));
  const availableSlots = program
    ? Array.from({ length: program.cycleLength }, (_, i) => i + 1).filter((v) => !usedVisitNumbers.has(v))
    : [];
  const activeMilestoneCount = sortedMilestones.filter((m) => m.isEnabled).length;

  // Live journey preview reflects changes while editing Program Settings
  const editCycleNum = parseInt(editForm.cycleLength, 10);
  const previewCycleLength =
    isEditingProgram && !isNaN(editCycleNum) && editCycleNum > 0
      ? editCycleNum
      : program?.cycleLength || 4;

  // Detect if reduced cycle conflicts with an existing ACTIVE reward
  const conflictingReward =
    isEditingProgram && !isNaN(editCycleNum) && editCycleNum > 0
      ? sortedMilestones.find((m) => m.isEnabled && m.visitNumber > editCycleNum)
      : null;

  const handleSaveProgramSettings = () => {
    if (!editForm.name.trim()) {
      setEditError('Program name cannot be empty');
      return;
    }
    if (isNaN(editCycleNum) || editCycleNum < 1) {
      setEditError('Please enter a valid visit count (at least 1)');
      return;
    }
    if (conflictingReward) {
      setEditError(
        `Active reward at Visit ${conflictingReward.visitNumber} (${conflictingReward.rewardName || 'Reward'}) exceeds ${editCycleNum} visits. Please disable, remove, or move that reward first.`
      );
      return;
    }
    setEditError(null);
    updateProgramMutation.mutate();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── 1. CLEAN TOP HEADER (No Decorative Badges) ───────────────── */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#172033] tracking-tight">
              Loyalty Programs
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
              Manage customer rewards and visits.
            </p>
          </div>

          {/* Location Selector (Clean Standard Control, Not a Badge) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-[#667085] font-medium">Location:</span>
            {branches.length > 1 ? (
              <select
                value={selectedBranchId || ''}
                onChange={(e) => handleSelectBranch(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-bold text-[#172033] hover:border-slate-300 focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 cursor-pointer min-h-[40px]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-[#172033] bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-3 py-2 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#667085]" />
                <span>{selectedBranch?.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. MAIN PROGRAM VIEW / EMPTY STATE ────────────────────────── */}
      {isProgramsLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D97706]" />
          <p className="text-xs text-[#667085] font-bold">Loading program details...</p>
        </div>
      ) : hasNoProgram ? (
        /* ── No Program Setup Form ── */
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#172033]">
                Set Up Loyalty Program for "{selectedBranch?.name}"
              </h2>
              <p className="text-xs text-[#667085]">
                Reward customers when they visit your business.
              </p>
            </div>
          </div>

          {createError && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-[#172033] uppercase mb-1.5">
                Program Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Salon Rewards, Café Loyalty Pass"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172033] uppercase mb-1.5">
                Description <span className="text-[#667085] font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="Brief explanation shown on customer loyalty passes..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
                className="w-full border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] resize-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172033] uppercase mb-1.5">
                Visits to complete <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  placeholder="4"
                  value={createForm.cycleLength}
                  onChange={(e) => setCreateForm({ ...createForm, cycleLength: e.target.value })}
                  className="w-24 border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-black text-center"
                />
                <span className="text-xs text-[#667085] font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#D97706] shrink-0" />
                  Customers complete the reward journey after {createForm.cycleLength || '?'} visits
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateProgram}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs sm:text-sm font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px]"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>Create Loyalty Program</span>
          </button>
        </div>
      ) : (
        /* ── Program Exists ── */
        <div className="space-y-4 sm:space-y-6">
          {/* Program Overview & Actions Card */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                {/* Meaningful Status Pill (Active / Inactive only) */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      program!.isActive
                        ? 'bg-[#EAFBEF] text-[#0E7A36] border-[#55E07E]/30'
                        : 'bg-slate-100 text-[#667085] border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        program!.isActive ? 'bg-[#55E07E]' : 'bg-slate-400'
                      }`}
                    />
                    {program!.isActive ? 'Active Program' : 'Inactive Program'}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight truncate">
                  {program!.name}
                </h2>
                {program!.description && (
                  <p className="text-xs sm:text-sm text-[#667085]">{program!.description}</p>
                )}

                {/* Simple Secondary Info Text (No Pill Clutter) */}
                <div className="flex items-center gap-2 pt-0.5 text-xs text-[#667085] font-medium">
                  <span>
                    {activeMilestoneCount} {activeMilestoneCount === 1 ? 'reward added' : 'rewards added'}
                  </span>
                  <span>•</span>
                  <span>{program!.cycleLength} visits to complete</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
                {program!.isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProgram((v) => !v);
                      setEditError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-slate-50 text-[#172033] text-xs font-bold shadow-2xs transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Program Settings</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStatusError(null);
                    setShowStatusConfirm(true);
                  }}
                  disabled={toggleStatusMutation.isPending}
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap ${
                    program!.isActive
                      ? 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
                      : 'border-[#55E07E]/40 text-[#0E7A36] bg-[#EAFBEF] hover:bg-[#55E07E]/20'
                  } disabled:opacity-60`}
                >
                  {toggleStatusMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5 stroke-[2.2]" />
                  )}
                  <span>{program!.isActive ? 'Deactivate Program' : 'Activate Program'}</span>
                </button>
              </div>
            </div>

            {/* Program Status Confirmation Modal */}
            {showStatusConfirm && (
              <div
                className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                onClick={() => !toggleStatusMutation.isPending && setShowStatusConfirm(false)}
              >
                <div
                  className="bg-[#FFFFFF] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-[#E5E7EB] p-5 sm:p-6 text-center animate-in zoom-in-95 duration-150 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Icon Badge */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                      program!.isActive
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-[#EAFBEF] border-[#55E07E]/40 text-[#0E7A36]'
                    }`}
                  >
                    <Power className="w-6 h-6 stroke-[2.2]" />
                  </div>

                  {/* Title & Message */}
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-[#172033]">
                      {program!.isActive ? 'Deactivate Loyalty Program?' : 'Activate Loyalty Program?'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#667085]">
                      {program!.isActive
                        ? `Customers will not earn stamps or unlock rewards while "${program!.name}" is paused.`
                        : `Customers will start earning stamps and unlocking rewards for "${program!.name}".`}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowStatusConfirm(false)}
                      disabled={toggleStatusMutation.isPending}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#667085] hover:text-[#172033] bg-[#FFFFFF] hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleStatusMutation.mutate(!program!.isActive)}
                      disabled={toggleStatusMutation.isPending}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[#FFFFFF] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[44px] disabled:opacity-60 ${
                        program!.isActive
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#0E7A36] hover:bg-[#0c6b2f]'
                      }`}
                    >
                      {toggleStatusMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>{program!.isActive ? 'Deactivate' : 'Activate'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status error */}
            {statusError && (
              <div className="mt-3 flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px text-rose-500" />
                <span>{statusError}</span>
              </div>
            )}
          </div>

          {/* Inactive Notice */}
          {!program!.isActive && (
            <div className="bg-[#FFF8E1] border border-[#FFE08A] rounded-2xl p-4 text-center">
              <p className="text-xs sm:text-sm text-[#92400E] font-bold">
                This program is currently paused. Activate it above to allow customers to collect stamps & earn rewards.
              </p>
            </div>
          )}

          {/* Success Banner */}
          {editSuccess && (
            <div className="flex items-center gap-2.5 text-[#0E7A36] bg-[#EAFBEF] border border-[#55E07E]/40 rounded-2xl p-3.5 text-xs sm:text-sm font-bold shadow-2xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 stroke-[2.5]" />
              <span>{editSuccess}</span>
            </div>
          )}

          {/* Edit Program Settings Panel */}
          {isEditingProgram && program!.isActive && (
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#172033] uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#D97706]" />
                  <span>Program Settings</span>
                </h3>
                <span className="text-[11px] text-[#667085]">
                  Currently saved: <strong className="text-[#172033]">{program!.cycleLength} visits</strong>
                </span>
              </div>

              {editError && (
                <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                    Program Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                    Visits to complete
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.cycleLength}
                    onChange={(e) => setEditForm({ ...editForm, cycleLength: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-black"
                  />
                  <p className="text-[11px] text-[#667085] mt-1">
                    How many total visits a customer completes before starting a new reward journey.
                  </p>
                </div>

                {/* Conflict warning if owner enters fewer visits than existing ACTIVE reward positions */}
                {conflictingReward && (
                  <div className="sm:col-span-2 flex items-start gap-2.5 text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">
                        Active reward at Visit {conflictingReward.visitNumber} ({conflictingReward.rewardName || 'Reward'}) conflicts with this setting
                      </p>
                      <p className="text-[11px] text-amber-800">
                        To set visits to complete to {editCycleNum}, please disable, remove, or move any active rewards beyond Visit {editCycleNum} first.
                      </p>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                    Description <span className="text-[#667085] font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] resize-none font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveProgramSettings}
                  disabled={updateProgramMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[40px]"
                >
                  {updateProgramMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 stroke-[2.2]" />
                  )}
                  <span>Save Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProgram(false);
                    setEditError(null);
                    if (program) {
                      setEditForm({
                        name: program.name,
                        description: program.description ?? '',
                        cycleLength: String(program.cycleLength),
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-[#667085] hover:text-[#172033] bg-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                >
                  <X className="w-3.5 h-3.5" /> <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* ── 3. VISUAL FOCUS: HOW CUSTOMERS EARN REWARDS ───────────────── */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs p-5 sm:p-6 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-xs sm:text-sm font-black text-[#172033] uppercase tracking-wider">
                  How customers earn rewards
                </h3>
              </div>
              {isEditingProgram && editCycleNum !== program!.cycleLength && !isNaN(editCycleNum) && editCycleNum > 0 && (
                <span className="text-[11px] font-bold text-[#D97706] bg-[#FFF8E1] border border-[#FFE08A] px-2 py-0.5 rounded-md">
                  Previewing {editCycleNum} visits
                </span>
              )}
            </div>

            {/* Clean Complete Journey Track (dynamically updates with preview cycle length) */}
            <JourneyPreview cycleLength={previewCycleLength} milestones={sortedMilestones} />
          </div>

          {/* ── 4. YOUR REWARDS (Clean Typography, No Badge Overuse) ───────── */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
            {/* Mobile Header (sm:hidden) */}
            <div className="sm:hidden pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#D97706] shrink-0" />
                    <h3 className="text-base font-black text-[#172033] shrink-0">
                      Your Rewards
                    </h3>
                    <span className="text-xs text-[#667085] font-normal shrink-0">
                      ({activeMilestoneCount} added)
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1 leading-snug">
                    Rewards your customers unlock after completing visits.
                  </p>
                </div>

                {availableSlots.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMilestone((v) => {
                        if (!v) setEditingMilestoneId(null);
                        return !v;
                      });
                    }}
                    className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[38px] shrink-0 self-center whitespace-nowrap"
                  >
                    {showAddMilestone ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{showAddMilestone ? 'Cancel' : 'Add Reward'}</span>
                  </button>
                ) : (
                  <span className="text-xs text-[#667085] font-medium shrink-0 self-center">
                    All added
                  </span>
                )}
              </div>
            </div>

            {/* Desktop Header (hidden sm:flex) - Preserved */}
            <div className="hidden sm:flex sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#172033] flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#D97706]" />
                  <span>Your Rewards</span>
                  <span className="text-xs text-[#667085] font-normal">
                    ({activeMilestoneCount} added)
                  </span>
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Rewards your customers unlock after completing visits.
                </p>
              </div>

              {availableSlots.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMilestone((v) => {
                      if (!v) setEditingMilestoneId(null);
                      return !v;
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[40px] shrink-0"
                >
                  {showAddMilestone ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
                  <span>{showAddMilestone ? 'Cancel' : 'Add Reward'}</span>
                </button>
              ) : (
                <span className="text-xs text-[#667085] font-medium shrink-0">
                  All visits have rewards added
                </span>
              )}
            </div>

            {/* Add Reward Form */}
            {showAddMilestone && (
              <div className="bg-[#FFFDF5] border-2 border-[#FFE08A] rounded-2xl p-4 sm:p-5 space-y-3.5 animate-in fade-in">
                <h4 className="text-xs font-black text-[#172033] uppercase tracking-wider">
                  Add New Reward
                </h4>

                {milestoneError && (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                    <span>{milestoneError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                      Which Visit? <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={milestoneForm.visitNumber}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, visitNumber: e.target.value })}
                      className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-bold cursor-pointer"
                    >
                      <option value="">Select Visit...</option>
                      {availableSlots.map((v) => (
                        <option key={v} value={v}>
                          Visit #{v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                      Reward Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={milestoneForm.rewardType}
                      onChange={(e) =>
                        setMilestoneForm({
                          ...milestoneForm,
                          rewardType: e.target.value as RewardType,
                          rewardValue: '',
                          rewardName: '',
                        })
                      }
                      className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-bold cursor-pointer"
                    >
                      <option value="FREE_ITEM">Free Item</option>
                      <option value="PERCENT_DISCOUNT">% Discount</option>
                      <option value="FIXED_DISCOUNT">Fixed Discount (₹)</option>
                      <option value="NONE">Stamp Checkpoint</option>
                    </select>
                  </div>
                </div>

                {milestoneForm.rewardType !== 'NONE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                        Reward Name {milestoneForm.rewardType === 'FREE_ITEM' && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Free Coffee, 20% Off Bill"
                        value={milestoneForm.rewardName}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardName: e.target.value })}
                        className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
                      />
                    </div>
                    {(milestoneForm.rewardType === 'PERCENT_DISCOUNT' ||
                      milestoneForm.rewardType === 'FIXED_DISCOUNT') && (
                      <div>
                        <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                          Value ({milestoneForm.rewardType === 'PERCENT_DISCOUNT' ? '% · max 100' : '₹ · in Rupees'})
                          <span className="text-rose-500 ml-1">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={milestoneForm.rewardType === 'PERCENT_DISCOUNT' ? '20' : '100'}
                          value={milestoneForm.rewardValue}
                          onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardValue: e.target.value })}
                          className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#172033] uppercase mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Valid on any hot beverage or haircut"
                        value={milestoneForm.rewardDescription}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardDescription: e.target.value })}
                        className="w-full border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#FFD444] focus:ring-2 focus:ring-[#FFD444]/20 bg-[#FFFFFF] font-medium"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-[#FFE08A]">
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    disabled={addMilestoneMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] text-xs font-black shadow-xs transition-all cursor-pointer active:scale-[0.98] min-h-[40px]"
                  >
                    {addMilestoneMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>Save Reward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMilestone(false);
                      setMilestoneError(null);
                      setMilestoneForm(defaultMilestoneForm);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-[#667085] hover:text-[#172033] bg-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
                  >
                    <X className="w-3.5 h-3.5" /> <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* Rewards List */}
            {sortedMilestones.length === 0 ? (
              <div className="text-center py-8 bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl">
                <Gift className="w-7 h-7 mx-auto mb-1.5 text-[#D97706] opacity-60" />
                <h4 className="text-xs sm:text-sm font-black text-[#172033]">No rewards added yet</h4>
                <p className="text-xs text-[#667085] mt-0.5 max-w-xs mx-auto">
                  Click "+ Add Reward" to reward your customers after they complete visits.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedMilestones.map((milestone) => (
                  <RewardCard
                    key={milestone.id}
                    milestone={milestone}
                    cycleLength={program!.cycleLength}
                    branchId={selectedBranchId!}
                    isEditing={editingMilestoneId === milestone.id}
                    onStartEdit={() => {
                      setShowAddMilestone(false);
                      setEditingMilestoneId(milestone.id);
                    }}
                    onCancelEdit={() => setEditingMilestoneId(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
