import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customerService } from '../../services/customerService';
import type { ExploreBusinessItem } from '../../services/customerService';
import { BusinessLoyaltyCardModal } from '../../components/customer/BusinessLoyaltyCardModal';
import { AaoMascot } from '../../components/ui/AaoBrand';
import {
  Search,
  MapPin,
  Sparkles,
  ArrowRight,
  Store,
  Coffee,
  UtensilsCrossed,
  Scissors,
  Dumbbell,
  ShoppingBag,
  Gift,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ALL', label: 'All', icon: Sparkles },
  { id: 'CAFE', label: 'Cafe & Coffee', icon: Coffee },
  { id: 'RESTAURANT', label: 'Dining', icon: UtensilsCrossed },
  { id: 'SALON', label: 'Salon', icon: Scissors },
  { id: 'FITNESS', label: 'Fitness', icon: Dumbbell },
  { id: 'RETAIL', label: 'Retail', icon: ShoppingBag },
];

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  if (currentPage <= 3) {
    pages.push(1, 2, 3, 'ellipsis', totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
  }
  return pages;
}

export const CustomerExplore: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const limit = 12;

  // Selected business for dedicated Loyalty Card / Detail modal
  const [selectedBusiness, setSelectedBusiness] = useState<ExploreBusinessItem | null>(null);

  // Debounce search query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // TanStack Query for server-side paginated, filtered, and searched explore data
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'customer-explore',
      {
        page,
        limit,
        search: debouncedSearch,
        category: selectedCategory,
      },
    ],
    queryFn: () =>
      customerService.getExploreBusinesses({
        page,
        limit,
        search: debouncedSearch,
        category: selectedCategory,
      }),
    staleTime: 30000,
  });

  const businesses = data?.items ?? [];
  const pagination = data?.pagination;

  // Format business category helper
  const getCategoryLabel = (type: string | null) => {
    if (!type) return 'Local Business';
    const found = CATEGORIES.find((c) => c.id === type.toUpperCase());
    return found ? found.label : type;
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  const pageNumbers = pagination ? getPageNumbers(pagination.page, pagination.totalPages) : [];

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-3.5 bg-[#F8FAFC]">
      {/* 1. Header Hierarchy */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD444]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#172033]">
            DISCOVER REWARDS
          </span>
        </div>
        <h1 className="text-xl font-black tracking-tight text-[#172033]">
          Explore
        </h1>
        <p className="text-xs text-[#667085] mt-0.5">
          Discover local businesses and start earning rewards with AAO.
        </p>
      </div>

      {/* 2. Search Field */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by business, branch or rewards..."
          className="w-full pl-10 pr-9 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#172033] placeholder-[#667085] focus:outline-none focus:ring-2 focus:ring-[#FFD444] focus:border-[#FFD444] transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#172033] p-1 cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 3. Category Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shadow-xs min-h-[36px] ${
                isActive
                  ? 'bg-[#FFD444] text-[#172033] ring-1 ring-[#FFD444]'
                  : 'bg-[#FFFFFF] text-[#667085] hover:text-[#172033] border border-[#E5E7EB]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Business List / Loading / Error / Empty States */}
      {isLoading ? (
        /* Lightweight Skeleton Cards */
        <div className="space-y-3 pt-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-4 space-y-3 animate-pulse shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="w-32 h-3.5 bg-slate-200 rounded" />
                    <div className="w-20 h-2.5 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="w-14 h-4 bg-slate-200 rounded-full" />
              </div>
              <div className="w-44 h-3 bg-slate-200 rounded" />
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <div className="w-36 h-3 bg-slate-200 rounded" />
                <div className="w-20 h-3 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        /* Error State */
        <div className="bg-[#FFFFFF] rounded-2xl border border-rose-200 p-6 text-center space-y-2.5 shadow-xs my-4">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="text-sm font-bold text-[#172033]">Couldn't load businesses.</h4>
          <p className="text-xs text-[#667085]">Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-1 px-4 py-2 rounded-xl bg-[#FFD444] hover:bg-[#F4EB6C] text-[#172033] font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : businesses.length === 0 ? (
        /* Empty State with Mascot */
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-8 text-center space-y-3 shadow-xs my-2">
          <AaoMascot mood="hello" size={68} className="mx-auto" />
          <div>
            <h4 className="text-sm font-black text-[#172033]">No businesses found</h4>
            <p className="text-xs text-[#667085] max-w-xs mx-auto mt-0.5 leading-relaxed">
              Try searching with another keyword or explore a different category.
            </p>
          </div>
          {(searchQuery || selectedCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setPage(1);
              }}
              className="mt-1 px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] text-xs font-bold text-[#172033] hover:bg-slate-100 transition-colors cursor-pointer inline-block"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        /* Real Simplified Business Cards */
        <div className="space-y-3 pt-0.5">
          {businesses.map((business) => {
            const program = business.program;
            const branch = business.branch;
            const milestones = program?.milestones || [];
            const rewardMilestones = milestones.filter(
              (m) => m.rewardType && m.rewardType !== 'NONE'
            );
            const primaryMilestone = rewardMilestones[rewardMilestones.length - 1] || rewardMilestones[0];

            let rewardText: string | null = null;
            if (rewardMilestones.length > 1) {
              const finalReward = rewardMilestones[rewardMilestones.length - 1];
              const finalName = finalReward.rewardName || finalReward.rewardType.replace(/_/g, ' ');
              rewardText = `${rewardMilestones.length} rewards: ${finalName} & more`;
            } else if (primaryMilestone) {
              rewardText = `${primaryMilestone.rewardName || primaryMilestone.rewardType.replace(/_/g, ' ')} after ${primaryMilestone.visitNumber} visits`;
            } else if (program) {
              rewardText = `Loyalty reward after ${program.cycleLength} visits`;
            }

            return (
              <div
                key={business.id}
                onClick={() => setSelectedBusiness(business)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBusiness(business);
                  }
                }}
                className="w-full text-left bg-[#FFFFFF] rounded-2xl border border-[#E5E7EB] p-4 shadow-xs hover:border-[#FFD444] hover:shadow-sm transition-all cursor-pointer group active:scale-[0.99] select-none"
              >
                {/* Business icon/name & status */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-center text-[#172033] shrink-0 group-hover:bg-[#FFD444]/20 transition-colors">
                      <Store className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[#172033] leading-tight truncate">
                        {business.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-[#667085] block mt-0.5">
                        {getCategoryLabel(business.type)}
                      </span>
                    </div>
                  </div>

                  {/* Enrollment status tag */}
                  {business.isEnrolled ? (
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#EAFBEF] text-[#0E7A36] font-extrabold text-[10px] border border-[#55E07E]/30">
                      Enrolled
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[#667085] font-semibold text-[10px] border border-slate-200">
                      New
                    </span>
                  )}
                </div>

                {/* Location / Branch */}
                {branch && (
                  <div className="flex items-center gap-1.5 text-xs text-[#667085] mb-3">
                    <MapPin className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                    <span className="truncate">
                      {branch.name}
                      {branch.address ? ` • ${branch.address}` : ''}
                    </span>
                  </div>
                )}

                {/* Reward Highlight & CTA */}
                <div className="pt-2.5 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                  {rewardText ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#0E7A36] font-bold min-w-0">
                      <Gift className="w-3.5 h-3.5 shrink-0 text-[#16A34A]" />
                      <span className="truncate">{rewardText}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#667085]">Loyalty program available</span>
                  )}

                  <span className="shrink-0 text-xs font-bold text-[#172033] group-hover:text-[#000000] flex items-center gap-1">
                    <span>View Pass</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Pagination Bar */}
      {!isLoading && pagination && pagination.totalPages > 1 && (
        <div className="pt-2 pb-1 flex items-center justify-between gap-1 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!pagination.hasPreviousPage || isFetching}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#172033] font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs min-h-[40px] cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-[#667085] font-bold">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={isFetching}
                  className={`min-w-[34px] h-9 px-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                    p === pagination.page
                      ? 'bg-[#FFD444] text-[#172033] ring-1 ring-[#FFD444]'
                      : 'bg-white text-[#667085] hover:text-[#172033] border border-[#E5E7EB]'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={!pagination.hasNextPage || isFetching}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#172033] font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs min-h-[40px] cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 6. Dedicated Business Loyalty Card Modal */}
      <BusinessLoyaltyCardModal
        business={selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
      />
    </div>
  );
};
