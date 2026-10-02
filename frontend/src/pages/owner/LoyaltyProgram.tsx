import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyService } from '../../services/loyaltyService';
import type { LoyaltyProgram as LoyaltyProgramType, Milestone, RewardType, CreateMilestoneRequest } from '../../types/loyalty';
import {
  ArrowLeft,
  Trophy,
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
  Gift,
  Star,
  Settings,
  Power,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface MilestoneFormState {
  visitNumber: string;
  rewardType: RewardType;
  rewardName: string;
  rewardDescription: string;
  rewardValue: string;
}

const defaultMilestoneForm: MilestoneFormState = {
  visitNumber: '',
  rewardType: 'NONE',
  rewardName: '',
  rewardDescription: '',
  rewardValue: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function getRewardTypeMeta(type: RewardType) {
  switch (type) {
    case 'PERCENT_DISCOUNT':
      return { label: '% Discount', color: 'text-violet-700 bg-violet-50 border-violet-200', icon: '%' };
    case 'FIXED_DISCOUNT':
      return { label: 'Fixed Discount', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: '₹' };
    case 'FREE_ITEM':
      return { label: 'Free Item', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '★' };
    default:
      return { label: 'Checkpoint', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: '·' };
  }
}

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as any).response;
    return r?.data?.message || r?.data?.error || 'An unexpected error occurred';
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

// ─── Journey Preview ──────────────────────────────────────────────────────

interface JourneyPreviewProps {
  cycleLength: number;
  milestones: Milestone[];
}

const JourneyPreview: React.FC<JourneyPreviewProps> = ({ cycleLength, milestones }) => {
  const milestoneMap = new Map(milestones.map((m) => [m.visitNumber, m]));
  const visits = Array.from({ length: cycleLength }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-max">
        {visits.map((visit, idx) => {
          const milestone = milestoneMap.get(visit);
          const isLast = idx === cycleLength - 1;
          const meta = milestone ? getRewardTypeMeta(milestone.rewardType) : null;

          return (
            <React.Fragment key={visit}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                    milestone
                      ? milestone.isEnabled
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 border-slate-300 text-slate-400'
                      : isLast
                        ? 'bg-amber-400 border-amber-500 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {isLast ? (
                    <Trophy className="w-3.5 h-3.5" />
                  ) : milestone ? (
                    <span className="text-[10px]">{meta?.icon}</span>
                  ) : (
                    visit
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">#{visit}</span>
                {milestone && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${meta?.color} ${!milestone.isEnabled ? 'opacity-40' : ''}`}
                  >
                    {milestone.rewardType === 'NONE' ? 'Check' : meta?.label}
                  </span>
                )}
              </div>

              {!isLast && (
                <div className={`h-px w-5 flex-shrink-0 mx-0.5 ${milestone ? 'bg-indigo-200' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Milestone Card ───────────────────────────────────────────────────────

interface MilestoneCardProps {
  milestone: Milestone;
  cycleLength: number;
  branchId: string;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, cycleLength, branchId }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<MilestoneFormState>({
    visitNumber: String(milestone.visitNumber),
    rewardType: milestone.rewardType,
    rewardName: milestone.rewardName ?? '',
    rewardDescription: milestone.rewardDescription ?? '',
    rewardValue: milestone.rewardValue ?? '',
  });

  const meta = getRewardTypeMeta(milestone.rewardType);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['loyalty-programs', branchId] });
  }

  const toggleMutation = useMutation({
    mutationFn: () => loyaltyService.updateMilestoneStatus(milestone.id, !milestone.isEnabled),
    onSuccess: invalidate,
    onError: (err) => setFormError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => loyaltyService.updateMilestone(milestone.id, payload),
    onSuccess: () => { invalidate(); setIsEditing(false); setFormError(null); },
    onError: (err) => setFormError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => loyaltyService.deleteMilestone(milestone.id),
    onSuccess: invalidate,
    onError: (err) => setFormError(extractError(err)),
  });

  const handleSave = () => {
    const visitNum = parseInt(form.visitNumber, 10);
    if (!form.visitNumber || isNaN(visitNum) || visitNum < 1) {
      setFormError('Visit number must be a positive integer');
      return;
    }
    if (visitNum > cycleLength) {
      setFormError(`Visit number cannot exceed the cycle length (${cycleLength})`);
      return;
    }
    if (form.rewardType === 'PERCENT_DISCOUNT') {
      const val = parseFloat(form.rewardValue);
      if (!form.rewardValue || isNaN(val) || val <= 0 || val > 100) {
        setFormError('PERCENT_DISCOUNT requires a value between 0 and 100');
        return;
      }
    }
    if (form.rewardType === 'FIXED_DISCOUNT') {
      const val = parseFloat(form.rewardValue);
      if (!form.rewardValue || isNaN(val) || val <= 0) {
        setFormError('FIXED_DISCOUNT requires a positive value');
        return;
      }
    }
    if (form.rewardType === 'FREE_ITEM' && !form.rewardName.trim()) {
      setFormError('FREE_ITEM requires a reward name');
      return;
    }

    const payload: any = { visitNumber: visitNum, rewardType: form.rewardType };
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
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        {formError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Visit #</label>
            <input
              type="number" min={1} max={cycleLength}
              value={form.visitNumber}
              onChange={(e) => setForm({ ...form, visitNumber: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reward Type</label>
            <select
              value={form.rewardType}
              onChange={(e) => setForm({ ...form, rewardType: e.target.value as RewardType, rewardValue: '', rewardName: '' })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="NONE">Checkpoint (no reward)</option>
              <option value="PERCENT_DISCOUNT">% Discount</option>
              <option value="FIXED_DISCOUNT">Fixed Discount (₹)</option>
              <option value="FREE_ITEM">Free Item</option>
            </select>
          </div>
        </div>

        {form.rewardType !== 'NONE' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Reward Name {form.rewardType === 'FREE_ITEM' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text" placeholder="e.g. Free Coffee"
                value={form.rewardName}
                onChange={(e) => setForm({ ...form, rewardName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            {(form.rewardType === 'PERCENT_DISCOUNT' || form.rewardType === 'FIXED_DISCOUNT') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Value ({form.rewardType === 'PERCENT_DISCOUNT' ? '% · max 100' : '₹ · must be > 0'})
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="number" min={0} step="0.01"
                  placeholder={form.rewardType === 'PERCENT_DISCOUNT' ? '25' : '50'}
                  value={form.rewardValue}
                  onChange={(e) => setForm({ ...form, rewardValue: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <input
                type="text" placeholder="Redemption instructions..."
                value={form.rewardDescription}
                onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave} disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={() => { setIsEditing(false); setFormError(null); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      milestone.isEnabled ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-50 border-slate-200 opacity-60'
    }`}>
      {/* Visit badge */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 ${
        milestone.isEnabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-200 border-slate-300 text-slate-500'
      }`}>
        {milestone.visitNumber}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${meta.color}`}>
            {meta.icon} {meta.label}
          </span>
          {milestone.rewardName && (
            <span className="text-sm font-medium text-slate-800 truncate">{milestone.rewardName}</span>
          )}
          {milestone.rewardValue && (
            <span className="text-xs text-slate-500">
              ({milestone.rewardType === 'PERCENT_DISCOUNT' ? `${milestone.rewardValue}%` : `₹${milestone.rewardValue}`})
            </span>
          )}
          {!milestone.isEnabled && <span className="text-[10px] text-slate-400">(disabled)</span>}
        </div>
        {milestone.rewardDescription && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{milestone.rewardDescription}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {formError && <span className="text-xs text-red-500 mr-1" title={formError}>!</span>}
        <button
          onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending}
          title={milestone.isEnabled ? 'Disable' : 'Enable'}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {toggleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
            milestone.isEnabled ? <ToggleRight className="w-4 h-4 text-indigo-500" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setIsEditing(true)} title="Edit"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete milestone at visit #${milestone.visitNumber}? This cannot be undone.`)) deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending} title="Delete"
          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
        >
          {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────

export const LoyaltyProgram: React.FC = () => {
  const { id: branchId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [createForm, setCreateForm] = useState({ name: '', description: '', cycleLength: '5' });
  const [createError, setCreateError] = useState<string | null>(null);

  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', cycleLength: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(defaultMilestoneForm);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);

  // ── Query ──────────────────────────────────────────────────────────
  const { data: programs, isLoading, isError } = useQuery({
    queryKey: ['loyalty-programs', branchId],
    queryFn: () => loyaltyService.getLoyaltyPrograms(branchId!),
    enabled: !!branchId,
  });

  // Most recent program (active or inactive); null if no programs exist
  const program: LoyaltyProgramType | null = programs?.[0] ?? null;
  const hasNoProgram = !isLoading && !isError && programs !== undefined && programs.length === 0;

  // Sync edit form when program data loads
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
    queryClient.invalidateQueries({ queryKey: ['loyalty-programs', branchId] });
  }

  // ── Create Mutation ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      loyaltyService.createLoyaltyProgram(branchId!, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        cycleLength: parseInt(createForm.cycleLength, 10),
      }),
    onSuccess: () => { invalidatePrograms(); setCreateError(null); },
    onError: (err) => setCreateError(extractError(err)),
  });

  // ── Update Program Mutation ────────────────────────────────────────
  const updateProgramMutation = useMutation({
    mutationFn: () =>
      loyaltyService.updateLoyaltyProgram(branchId!, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        cycleLength: parseInt(editForm.cycleLength, 10),
      }),
    onSuccess: () => {
      invalidatePrograms();
      setIsEditingProgram(false);
      setEditError(null);
      setEditSuccess('Program updated.');
      setTimeout(() => setEditSuccess(null), 3000);
    },
    onError: (err) => setEditError(extractError(err)),
  });

  // ── Status Toggle Mutation ─────────────────────────────────────────
  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      loyaltyService.updateLoyaltyProgramStatus(program!.id, isActive),
    onSuccess: () => { invalidatePrograms(); setStatusError(null); },
    onError: (err) => setStatusError(extractError(err)),
  });

  // ── Add Milestone Mutation ─────────────────────────────────────────
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
      setMilestoneError('Visit number must be a positive integer');
      return;
    }
    if (program && visitNum > program.cycleLength) {
      setMilestoneError(`Visit number cannot exceed the cycle length (${program.cycleLength})`);
      return;
    }
    if (milestoneForm.rewardType === 'PERCENT_DISCOUNT') {
      const val = parseFloat(milestoneForm.rewardValue);
      if (!milestoneForm.rewardValue || isNaN(val) || val <= 0 || val > 100) {
        setMilestoneError('PERCENT_DISCOUNT requires a value between 0 (exclusive) and 100');
        return;
      }
    }
    if (milestoneForm.rewardType === 'FIXED_DISCOUNT') {
      const val = parseFloat(milestoneForm.rewardValue);
      if (!milestoneForm.rewardValue || isNaN(val) || val <= 0) {
        setMilestoneError('FIXED_DISCOUNT requires a positive value');
        return;
      }
    }
    if (milestoneForm.rewardType === 'FREE_ITEM' && !milestoneForm.rewardName.trim()) {
      setMilestoneError('FREE_ITEM requires a reward name');
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
    if (!createForm.name.trim()) { setCreateError('Program name is required'); return; }
    if (!createForm.cycleLength || isNaN(cycleLen) || cycleLen < 1) { setCreateError('Cycle length must be at least 1'); return; }
    setCreateError(null);
    createMutation.mutate();
  };

  // ─── Loading ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-9 h-9 text-red-400" />
        <p className="text-slate-600 text-sm">Failed to load loyalty programs.</p>
        <button
          onClick={invalidatePrograms}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const backLink = (
    <Link
      to={`/owner/branches/${branchId}`}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Branch
    </Link>
  );

  // ═══════════════════════════════════════════════════════════════════
  // ── No Program: Create Form ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  if (hasNoProgram) {
    return (
      <div className="space-y-6">
        {backLink}

        {/* Page header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Set Up Loyalty Program</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10.5">
            Define how many visits complete a cycle, then add milestone rewards.
          </p>
        </div>

        {/* Create form */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Program Details
          </h2>

          {createError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Program Name <span className="text-red-500">*</span></label>
              <input
                type="text" placeholder="e.g. Café Loyalty Rewards"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                placeholder="Shown to customers..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cycle Length <span className="text-red-500">*</span>
                <span className="ml-1.5 text-xs font-normal text-slate-400">— visits to complete one loyalty cycle</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min={1} placeholder="10"
                  value={createForm.cycleLength}
                  onChange={(e) => setCreateForm({ ...createForm, cycleLength: e.target.value })}
                  className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Customer completes cycle after {createForm.cycleLength || '?'} visits
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateProgram} disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Loyalty Program
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ── Program Exists (active or inactive) ────────────────────────────
  // ═══════════════════════════════════════════════════════════════════

  const sortedMilestones = [...(program?.milestones ?? [])].sort((a, b) => a.visitNumber - b.visitNumber);
  const usedVisitNumbers = new Set(sortedMilestones.map((m) => m.visitNumber));
  const availableSlots = program
    ? Array.from({ length: program.cycleLength }, (_, i) => i + 1).filter((v) => !usedVisitNumbers.has(v))
    : [];
  const activeMilestoneCount = sortedMilestones.filter((m) => m.isEnabled).length;

  return (
    <div className="space-y-5">
      {backLink}

      {/* ── Program Header Card ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                program!.isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${program!.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {program!.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 truncate">{program!.name}</h1>
            {program!.description && (
              <p className="text-sm text-slate-500 mt-0.5">{program!.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span>{program!.cycleLength} visits / cycle</span>
              {program!.isActive && (
                <span>{activeMilestoneCount} active milestone{activeMilestoneCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {program!.isActive && (
              <button
                onClick={() => setIsEditingProgram((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={() => {
                const msg = program!.isActive
                  ? 'Deactivate this loyalty program? Customers will no longer earn visits.'
                  : `Activate "${program!.name}"? Customers can start earning visits.`;
                if (confirm(msg)) {
                  setStatusError(null);
                  toggleStatusMutation.mutate(!program!.isActive);
                }
              }}
              disabled={toggleStatusMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                program!.isActive
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
              } disabled:opacity-60`}
            >
              {toggleStatusMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Power className="w-3.5 h-3.5" />}
              {program!.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>

        {/* Status error (e.g. 409 on activation) */}
        {statusError && (
          <div className="mt-3 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span>{statusError}</span>
          </div>
        )}
      </div>

      {/* ── Inactive state notice ───────────────────────────────────── */}
      {!program!.isActive && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-sm text-slate-500">
            This program is currently <span className="font-semibold text-slate-700">inactive</span>.
            Activate it to manage milestones and allow customers to earn visits.
          </p>
          {programs && programs.length === 1 && (
            <p className="text-xs text-slate-400 mt-1.5">
              You can also create a new program once this one is activated and then deactivated.
            </p>
          )}
        </div>
      )}

      {/* ── Success banner ──────────────────────────────────────────── */}
      {editSuccess && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{editSuccess}</span>
        </div>
      )}

      {/* ── Edit Program Panel (active only) ───────────────────────── */}
      {isEditingProgram && program!.isActive && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Edit Program
          </h2>

          {editError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Program Name</label>
              <input
                type="text" value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Cycle Length
                <span className="ml-1 font-normal text-slate-400">(≥ highest milestone visit #)</span>
              </label>
              <input
                type="number" min={1} value={editForm.cycleLength}
                onChange={(e) => setEditForm({ ...editForm, cycleLength: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateProgramMutation.mutate()} disabled={updateProgramMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {updateProgramMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            <button
              onClick={() => { setIsEditingProgram(false); setEditError(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Active program management ────────────────────────────────── */}
      {program!.isActive && (
        <>
          {/* Journey Preview */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-amber-500" />
              Customer Journey
              <span className="text-xs font-normal text-slate-400">
                — {program!.cycleLength} visits / cycle
              </span>
            </h2>
            <JourneyPreview cycleLength={program!.cycleLength} milestones={sortedMilestones} />
            <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Indigo = milestone · Amber = cycle completion · Grey = disabled
            </p>
          </div>

          {/* Milestones */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-slate-400" />
                Milestones
                <span className="text-xs font-normal text-slate-400">
                  ({sortedMilestones.length} / {program!.cycleLength} slots used)
                </span>
              </h2>
              {availableSlots.length > 0 ? (
                <button
                  onClick={() => setShowAddMilestone((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  {showAddMilestone ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddMilestone ? 'Cancel' : 'Add Milestone'}
                </button>
              ) : (
                <span className="text-xs text-slate-400">All slots filled</span>
              )}
            </div>

            {/* Add milestone form */}
            {showAddMilestone && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-700">New Milestone</h3>

                {milestoneError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{milestoneError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Visit # (1–{program!.cycleLength})</label>
                    <select
                      value={milestoneForm.visitNumber}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, visitNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                      <option value="">Select...</option>
                      {availableSlots.map((v) => (
                        <option key={v} value={v}>Visit #{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reward Type</label>
                    <select
                      value={milestoneForm.rewardType}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardType: e.target.value as RewardType, rewardValue: '', rewardName: '' })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                      <option value="NONE">Checkpoint (no reward)</option>
                      <option value="PERCENT_DISCOUNT">% Discount</option>
                      <option value="FIXED_DISCOUNT">Fixed Discount (₹)</option>
                      <option value="FREE_ITEM">Free Item</option>
                    </select>
                  </div>
                </div>

                {milestoneForm.rewardType !== 'NONE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Reward Name {milestoneForm.rewardType === 'FREE_ITEM' && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text" placeholder="e.g. Free Espresso"
                        value={milestoneForm.rewardName}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardName: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      />
                    </div>
                    {(milestoneForm.rewardType === 'PERCENT_DISCOUNT' || milestoneForm.rewardType === 'FIXED_DISCOUNT') && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Value ({milestoneForm.rewardType === 'PERCENT_DISCOUNT' ? '% · max 100' : '₹ · must be > 0'})
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="number" min={0} step="0.01"
                          placeholder={milestoneForm.rewardType === 'PERCENT_DISCOUNT' ? '25' : '50'}
                          value={milestoneForm.rewardValue}
                          onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardValue: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                      <input
                        type="text" placeholder="Redemption instructions..."
                        value={milestoneForm.rewardDescription}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, rewardDescription: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddMilestone} disabled={addMilestoneMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {addMilestoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddMilestone(false); setMilestoneError(null); setMilestoneForm(defaultMilestoneForm); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Milestone list */}
            {sortedMilestones.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Star className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No milestones yet.</p>
                <p className="text-xs mt-1 text-slate-400">Add milestones to reward customers at specific visit counts.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMilestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    cycleLength={program!.cycleLength}
                    branchId={branchId!}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
