import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import type { CustomerHistoryItem } from '../../services/customerService';
import {
  Phone,
  LogOut,
  ShieldCheck,
  Lock,
  Gift,
  ChevronRight,
  Compass,
} from 'lucide-react';


export const CustomerProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalVisits: 0,
    rewardsUnlocked: 0,
    activePrograms: 0,
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const history: CustomerHistoryItem[] = await customerService.getCustomerHistory();
        let visits = 0;
        let rewards = 0;
        let active = 0;
        for (const item of history) {
          for (const cycle of item.cycles) {
            visits += cycle.visits.length;
            rewards += cycle.rewards.length;
            if (cycle.status === 'ACTIVE' || cycle.status === 'IN_PROGRESS') {
              active++;
            }
          }
        }

        setStats({
          totalVisits: visits,
          rewardsUnlocked: rewards,
          activePrograms: active,
        });
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      }
    };

    loadStats();
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
      {/* Profile Card */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-[#E5E7EB] shadow-xs flex flex-col items-center text-center relative overflow-hidden">
        {/* User Avatar with Yellow Brand Color */}
        <div className="w-20 h-20 rounded-full bg-[#FFD444] border-2 border-white flex items-center justify-center text-[#172033] text-2xl font-black shadow-sm mb-3">
          {initials}
        </div>

        <h1 className="text-xl font-bold text-[#172033] leading-tight">
          {user?.name || 'Valued Member'}
        </h1>
        <p className="text-xs font-mono text-[#667085] mt-1 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-[#667085]" />
          <span>{user?.phone || 'Phone verified'}</span>
        </p>

        {/* Member Badge with Yellow Accent */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD444]/20 border border-[#FFD444]/40 text-[#172033] text-xs font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#172033]" />
          <span>VERIFIED MEMBER</span>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
          <span className="text-[10px] uppercase font-bold text-[#667085] block tracking-wider">
            Stamps
          </span>
          <span className="text-xl font-black text-[#172033] mt-0.5 block">
            {stats.totalVisits}
          </span>
          <span className="text-[10px] text-[#667085]">Collected</span>
        </div>

        {/* Rewards stat uses AAO Green */}
        <div className="bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
          <span className="text-[10px] uppercase font-bold text-[#667085] block tracking-wider">
            Rewards
          </span>
          <span className="text-xl font-black text-[#0E7A36] mt-0.5 block">
            {stats.rewardsUnlocked}
          </span>
          <span className="text-[10px] text-[#0E7A36] font-extrabold">Unlocked</span>
        </div>

        <div className="bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
          <span className="text-[10px] uppercase font-bold text-[#667085] block tracking-wider">
            Active Passes
          </span>
          <span className="text-xl font-black text-[#172033] mt-0.5 block">
            {stats.activePrograms}
          </span>
          <span className="text-[10px] text-[#667085]">Enrolled</span>
        </div>
      </div>

      {/* Quick Navigation Links */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] divide-y divide-[#E5E7EB] shadow-xs overflow-hidden">
        <button
          onClick={() => navigate('/customer/explore')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFD444]/25 text-[#172033] flex items-center justify-center">
              <Compass className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#172033]">Explore New Passes</p>
              <p className="text-[11px] text-[#667085]">Discover more stores offering rewards</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#667085]" />
        </button>

        <button
          onClick={() => navigate('/customer/rewards')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EAFBEF] text-[#16A34A] flex items-center justify-center border border-[#55E07E]/30">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#172033]">My Unlocked Rewards</p>
              <p className="text-[11px] text-[#667085]">View all active reward vouchers & QRs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#667085]" />
        </button>
      </div>

      {/* Security & Account Information */}
      <div className="bg-[#FFFFFF] rounded-2xl p-4 border border-[#E5E7EB] shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Security & Privacy</span>
        </h3>
        <p className="text-xs text-[#667085] leading-relaxed">
          Your loyalty stamps, visits, and redeemed vouchers are cryptographically verified and bound securely to your registered phone number.
        </p>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-3">
            <p className="text-xs font-bold text-rose-900">Are you sure you want to sign out?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#172033] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={logout}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
