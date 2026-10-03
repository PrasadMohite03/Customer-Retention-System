import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { businessService } from '../../services/businessService';
import { branchService } from '../../services/branchService';
import { staffManagementService } from '../../services/staffManagementService';
import { staffService } from '../../services/staffService';
import {
  Layers,
  Store,
  Building2,
  ArrowRight,
  Users,
  ClipboardCheck,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();

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
    refetchInterval: 10000,
  });

  const activeBranches = branches.filter((b) => b.isActive).length;
  const activeStaff = staffList.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Welcome back{business?.name ? `, ${business.name}` : ''}
            </h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            Your business workspace is authenticated and isolated. Manage your physical branches, staff accounts, loyalty program, and customer check-ins below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">User ID</span>
            <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.id}</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Email</span>
            <p className="text-xs font-mono text-slate-800 mt-1 truncate">{user?.email || 'N/A'}</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Tenant Business ID</span>
            <p className="text-xs font-mono text-indigo-600 font-medium mt-1 truncate">
              {business?.id || user?.businessId || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid - 5 Core Operational Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Business Profile Card */}
        <Link
          to="/owner/business"
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">Business Profile</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {business ? `${business.name} (${business.type || 'General'})` : 'Configure your brand details and settings.'}
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage Profile</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Branch Management Card */}
        <Link
          to="/owner/branches"
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">Branch Locations</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {branches.length > 0
                ? `${branches.length} configured (${activeBranches} active) with unique QR tokens.`
                : 'Configure physical branches, addresses, and individual branch QR codes.'}
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage Branches</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Loyalty Engine Card */}
        <Link
          to="/owner/branches"
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 text-base">Loyalty Engine</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configurable visit milestones, cycle lengths, and milestone rewards linked to branches.
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage Loyalty</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Staff Management Card */}
        <Link
          to="/owner/staff"
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 text-base">Staff Accounts</h3>
              {staffList.length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                  {activeStaff} active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {staffList.length > 0
                ? `${staffList.length} staff member(s) assigned across branches to verify visits.`
                : 'Create and assign staff members to specific branch locations.'}
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Manage Staff</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Visit Requests Card */}
        <Link
          to="/owner/visit-requests"
          className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 text-base">Visit Requests</h3>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {pendingRequests.length > 0
                ? `${pendingRequests.length} incoming check-in request(s) waiting for approval.`
                : 'Live queue of customer QR check-in requests across all branch locations.'}
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>Review Requests</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
