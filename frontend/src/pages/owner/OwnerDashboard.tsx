import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { businessService } from '../../services/businessService';
import { branchService } from '../../services/branchService';
import { staffManagementService } from '../../services/staffManagementService';
import { staffService } from '../../services/staffService';
import { loyaltyService } from '../../services/loyaltyService';
import { AaoMascot } from '../../components/ui/AaoBrand';
import {
  Gift,
  Store,
  Building2,
  ArrowRight,
  Users,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Coffee,
  Scissors,
  Dumbbell,
  Car,
  Utensils,
  Sparkles,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => businessService.getBusiness(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getBranches(),
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staffList'],
    queryFn: () => staffManagementService.getStaffList(),
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingVisitRequests'],
    queryFn: () => staffService.getPendingRequests(),
    refetchInterval: 5000,
  });

  const primaryBranchId = branches[0]?.id;
  const { data: primaryProgram } = useQuery({
    queryKey: ['loyalty-program-primary', primaryBranchId],
    queryFn: () => loyaltyService.getLoyaltyProgram(primaryBranchId!),
    enabled: !!primaryBranchId,
    retry: false,
  });

  const activeBranches = branches.filter((b) => b.isActive).length;
  const activeStaff = staffList.filter((s) => s.isActive).length;
  const pendingCount = pendingRequests.length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getCategoryIcon = (type?: string | null) => {
    if (!type) return <Store className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    const normalized = type.toUpperCase();
    if (normalized.includes('CAFE') || normalized.includes('COFFEE')) {
      return <Coffee className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('RESTAURANT') || normalized.includes('DINING') || normalized.includes('FOOD')) {
      return <Utensils className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('SALON') || normalized.includes('BEAUTY') || normalized.includes('SPA') || normalized.includes('HAIR')) {
      return <Scissors className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('FITNESS') || normalized.includes('GYM')) {
      return <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('CAR') || normalized.includes('AUTO')) {
      return <Car className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    if (normalized.includes('WELLNESS')) {
      return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
    }
    return <Store className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />;
  };

  const activeRewardsCount =
    primaryProgram?.milestones?.filter(
      (m) => m.isEnabled && m.rewardType !== 'NONE'
    ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── 1. HERO / GREETING ────────────────────────────────────────── */}
      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FFF8E1] border border-[#FFE08A] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
              <AaoMascot mood="hello" size={48} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#172033] tracking-tight flex items-center gap-2 flex-wrap">
                <span>{getGreeting()}{business?.name ? `, ${business.name}` : ''}</span>
                <span
                  className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] shrink-0"
                  title={business?.type || 'Business'}
                >
                  {getCategoryIcon(business?.type)}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
                Here's what's happening today.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto shrink-0 w-full sm:w-auto">
            {pendingCount > 0 ? (
              <Link
                to="/owner/visit-requests"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] min-h-[44px]"
              >
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                <span>{pendingCount} {pendingCount === 1 ? 'customer is' : 'customers are'} waiting</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            ) : (
              <Link
                to="/owner/visit-requests"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#EAFBEF] hover:bg-[#55E07E]/20 text-[#0E7A36] border border-[#55E07E]/40 font-bold text-xs sm:text-sm transition-all min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-[#0E7A36]" />
                <span>All caught up</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. NEEDS YOUR ATTENTION (Operational Priority) ─────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 rounded-full bg-[#FFD444]" />
            <span className="text-xs font-black text-[#172033] uppercase tracking-wider">
              Needs Your Attention
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-md bg-[#FFD444] text-[#172033] border border-[#FFE08A]">
              {pendingCount} Waiting
            </span>
          )}
        </div>

        {pendingCount > 0 ? (
          <div className="bg-[#FFFDF5] border-2 border-[#FFD444] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FFD444] text-[#172033] flex items-center justify-center shrink-0 shadow-2xs">
                <Clock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#172033]">
                  {pendingCount} {pendingCount === 1 ? 'customer is' : 'customers are'} waiting
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Approve their visits to add their stamps.
                </p>
              </div>
            </div>

            <Link
              to="/owner/visit-requests"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-black text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] min-h-[44px] shrink-0 self-stretch sm:self-auto"
            >
              <span>Review Visits</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        ) : (
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#EAFBEF] border border-[#55E07E]/30 text-[#0E7A36] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#172033]">
                  You're all caught up!
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  No customer visits are waiting right now.
                </p>
              </div>
            </div>

            <Link
              to="/owner/visit-requests"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#FFF8E1] hover:border-[#FFE08A] text-[#172033] border border-[#E5E7EB] font-bold text-xs sm:text-sm transition-all min-h-[44px] shrink-0 self-stretch sm:self-auto"
            >
              <span>View Visits</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* ── 3. YOUR BUSINESS (Quick Status) ────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-3.5 rounded-full bg-[#FFD444]" />
          <span className="text-xs font-black text-[#172033] uppercase tracking-wider">
            Your Business
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* Card 1: Visits Waiting */}
          <Link
            to="/owner/visit-requests"
            className={`border rounded-2xl p-3 sm:p-5 shadow-xs transition-all flex flex-col justify-between group cursor-pointer ${
              pendingCount > 0
                ? 'bg-[#FFFDF5] border-[#FFD444] hover:border-[#F4EB6C]'
                : 'bg-[#FFFFFF] border-[#E5E7EB] hover:border-[#FFD444]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black text-[#667085] uppercase tracking-wider truncate">
                VISITS WAITING
              </span>
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  pendingCount > 0
                    ? 'bg-[#FFD444] text-[#172033]'
                    : 'bg-[#EAFBEF] text-[#0E7A36] border border-[#55E07E]/30'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <p
                className={`text-xl sm:text-2xl font-black ${
                  pendingCount > 0 ? 'text-[#D97706]' : 'text-[#172033]'
                }`}
              >
                {pendingCount}
              </p>
              <span className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 block truncate font-medium">
                {pendingCount === 0
                  ? 'No visits waiting'
                  : pendingCount === 1
                  ? '1 visit waiting'
                  : `${pendingCount} visits waiting`}
              </span>
            </div>
          </Link>

          {/* Card 2: Locations */}
          <Link
            to="/owner/branches"
            className="bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] p-3 sm:p-5 rounded-2xl shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black text-[#667085] uppercase tracking-wider truncate">
                LOCATIONS
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-[#FFF8E1] text-[#D97706] border border-[#FFE08A] flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-xl sm:text-2xl font-black text-[#172033]">
                {activeBranches}
                <span className="text-[10px] sm:text-xs font-bold text-[#667085]"> / {branches.length}</span>
              </p>
              <span className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 block truncate font-medium">
                {activeBranches === 1 ? '1 active location' : `${activeBranches} active locations`}
              </span>
            </div>
          </Link>

          {/* Card 3: Staff */}
          <Link
            to="/owner/staff"
            className="bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] p-3 sm:p-5 rounded-2xl shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black text-[#667085] uppercase tracking-wider truncate">
                STAFF
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-[#F8FAFC] text-[#172033] border border-[#E5E7EB] group-hover:bg-[#FFF8E1] group-hover:border-[#FFE08A] flex items-center justify-center shrink-0 transition-colors">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <p className="text-xl sm:text-2xl font-black text-[#172033]">
                {activeStaff}
                <span className="text-[10px] sm:text-xs font-bold text-[#667085]"> / {staffList.length}</span>
              </p>
              <span className="text-[10px] sm:text-[11px] text-[#667085] mt-0.5 block truncate font-medium">
                {activeStaff === 1 ? '1 active staff member' : `${activeStaff} active staff members`}
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 4. MANAGE YOUR BUSINESS ───────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-3.5 rounded-full bg-[#FFD444]" />
          <span className="text-xs font-black text-[#172033] uppercase tracking-wider">
            Manage Your Business
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* 1. Locations & QR Codes */}
          <Link
            to="/owner/branches"
            className="group bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex items-center justify-between gap-3.5 cursor-pointer min-h-[72px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF8E1] border border-[#FFE08A] text-[#D97706] flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-[#172033] group-hover:text-[#D97706] transition-colors">
                    Locations & QR Codes
                  </h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#EAFBEF] border border-[#55E07E]/30 text-[#0E7A36]">
                    {activeBranches} Active
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5 truncate">
                  Manage your stores and customer QR codes.
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] group-hover:bg-[#FFD444] text-[#667085] group-hover:text-[#172033] flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* 2. Staff */}
          <Link
            to="/owner/staff"
            className="group bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex items-center justify-between gap-3.5 cursor-pointer min-h-[72px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] group-hover:bg-[#FFF8E1] group-hover:border-[#FFE08A] text-[#172033] group-hover:text-[#D97706] flex items-center justify-center shrink-0 transition-colors">
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-[#172033] group-hover:text-[#D97706] transition-colors">
                    Staff
                  </h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E5E7EB] text-[#667085]">
                    {activeStaff} Active
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5 truncate">
                  Add staff and manage who can approve visits.
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] group-hover:bg-[#FFD444] text-[#667085] group-hover:text-[#172033] flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* 3. Rewards (Featured Core Product) */}
          <Link
            to={primaryBranchId ? `/owner/loyalty-programs?branchId=${primaryBranchId}` : '/owner/loyalty-programs'}
            className="group bg-[#FFFDF5] border-2 border-[#FFE08A] hover:border-[#FFD444] rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex items-center justify-between gap-3.5 cursor-pointer min-h-[72px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#FFD444] text-[#172033] flex items-center justify-center shrink-0 shadow-2xs">
                <Gift className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-[#172033]">
                    Rewards
                  </h4>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#FFD444] text-[#172033] border border-[#FFE08A]">
                    {primaryProgram
                      ? `${primaryProgram.cycleLength} visits • ${activeRewardsCount} ${activeRewardsCount === 1 ? 'reward' : 'rewards'}`
                      : 'Stamps & Rewards'}
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5 truncate">
                  Set up stamps and rewards for your customers.
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#FFD444]/50 group-hover:bg-[#FFD444] text-[#172033] flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* 4. Business Details */}
          <Link
            to="/owner/business"
            className="group bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#FFD444] rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex items-center justify-between gap-3.5 cursor-pointer min-h-[72px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] group-hover:bg-[#FFF8E1] group-hover:border-[#FFE08A] text-[#172033] group-hover:text-[#D97706] flex items-center justify-center shrink-0 transition-colors">
                <Building2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-[#172033] group-hover:text-[#D97706] transition-colors">
                    Business Details
                  </h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FFF8E1] border border-[#FFE08A] text-[#92400E]">
                    {business?.type || 'Business'}
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5 truncate">
                  Update your business information.
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] group-hover:bg-[#FFD444] text-[#667085] group-hover:text-[#172033] flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};



