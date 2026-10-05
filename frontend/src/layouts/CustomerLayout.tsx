import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Compass,
  QrCode,
  Gift,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customerService } from '../services/customerService';
import { AaoLogo } from '../components/ui/AaoBrand';

export const CustomerLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [unlockedCount, setUnlockedCount] = useState<number>(0);

  // Read available unlocked rewards count for notification badge
  useEffect(() => {
    let isMounted = true;
    const fetchBadgeCount = async () => {
      try {
        const history = await customerService.getCustomerHistory();
        let count = 0;
        for (const item of history) {
          for (const cycle of item.cycles) {
            count += cycle.rewards.filter((r) => r.status === 'UNLOCKED').length;
          }
        }
        if (isMounted) setUnlockedCount(count);
      } catch {
        // Silent catch for layout badge
      }
    };

    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-100 sm:bg-slate-200/80 flex justify-center text-[#172033] font-sans">
      {/* Mobile-first centered phone frame */}
      <div className="w-full max-w-md min-h-screen bg-[#F8FAFC] flex flex-col relative shadow-md border-x border-[#E5E7EB] pb-24">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between">
          <NavLink to="/customer/dashboard" className="flex items-center gap-2">
            <AaoLogo variant="full" size="sm" className="h-7 w-auto" />
            <span className="hidden sm:inline-block text-[10px] text-[#667085] font-semibold tracking-wide border-l border-[#E5E7EB] pl-2">
              Scan • Earn • Return
            </span>
          </NavLink>

          <NavLink
            to="/customer/profile"
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#F8FAFC] hover:bg-slate-100 border border-[#E5E7EB] transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-[#FFD444] text-[#172033] font-black text-xs flex items-center justify-center">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-bold text-[#172033] max-w-[80px] truncate">
              {user?.name ? user.name.split(' ')[0] : 'Profile'}
            </span>
          </NavLink>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>

        {/* Persistent Bottom Navigation Bar */}
        <nav
          aria-label="Bottom Navigation"
          className="fixed bottom-0 z-40 w-full max-w-md bg-[#FFFFFF] border-t border-[#E5E7EB] px-2 py-1.5 shadow-[0_-2px_12px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-around relative">
            {/* 1. Home */}
            <NavLink
              to="/customer/dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#172033] font-bold'
                    : 'text-[#667085] hover:text-[#172033] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Home
                    className={`w-5 h-5 mb-0.5 ${
                      isActive ? 'stroke-[2.6] text-[#172033]' : 'stroke-[1.8]'
                    }`}
                  />
                  <span className="text-[10px] leading-tight">Home</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444] mt-0.5" />
                  )}
                </>
              )}
            </NavLink>

            {/* 2. Explore */}
            <NavLink
              to="/customer/explore"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#172033] font-bold'
                    : 'text-[#667085] hover:text-[#172033] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Compass
                    className={`w-5 h-5 mb-0.5 ${
                      isActive ? 'stroke-[2.6] text-[#172033]' : 'stroke-[1.8]'
                    }`}
                  />
                  <span className="text-[10px] leading-tight">Explore</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444] mt-0.5" />
                  )}
                </>
              )}
            </NavLink>

            {/* 3. Center Elevated SCAN Button - AAO Primary Yellow #FFD444 */}
            <div className="relative -top-5 flex flex-col items-center">
              <NavLink
                to="/customer/scan"
                aria-label="Scan in-store QR code"
                className={({ isActive }) =>
                  `w-14 h-14 rounded-full flex items-center justify-center text-[#172033] shadow-md transition-all active:scale-95 border-4 border-[#FFFFFF] ${
                    isActive
                      ? 'bg-[#FFD444] ring-4 ring-[#FFD444]/30'
                      : 'bg-[#FFD444] hover:bg-[#FACC15]'
                  }`
                }
              >
                <QrCode className="w-6 h-6 stroke-[2.5] text-[#172033]" />
              </NavLink>
              <span className="text-[10px] font-black text-[#172033] tracking-tight mt-1">
                SCAN
              </span>
            </div>

            {/* 4. Rewards */}
            <NavLink
              to="/customer/rewards"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                  isActive
                    ? 'text-[#172033] font-bold'
                    : 'text-[#667085] hover:text-[#172033] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Gift
                      className={`w-5 h-5 mb-0.5 ${
                        isActive ? 'stroke-[2.6] text-[#172033]' : 'stroke-[1.8]'
                      }`}
                    />
                    {unlockedCount > 0 && (
                      <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-[#55E07E] text-[#172033] text-[9px] font-black border border-white">
                        {unlockedCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-tight">Rewards</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444] mt-0.5" />
                  )}
                </>
              )}
            </NavLink>

            {/* 5. Profile */}
            <NavLink
              to="/customer/profile"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#172033] font-bold'
                    : 'text-[#667085] hover:text-[#172033] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <User
                    className={`w-5 h-5 mb-0.5 ${
                      isActive ? 'stroke-[2.6] text-[#172033]' : 'stroke-[1.8]'
                    }`}
                  />
                  <span className="text-[10px] leading-tight">Profile</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD444] mt-0.5" />
                  )}
                </>
              )}
            </NavLink>
          </div>
        </nav>
      </div>
    </div>
  );
};
