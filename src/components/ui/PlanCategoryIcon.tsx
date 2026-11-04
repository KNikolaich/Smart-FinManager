import { ArrowLeftRight } from 'lucide-react';
import type { Category, PlannedPayment } from '../../types';
import { getPlanCategoryIcon, getPlanColor } from '../../lib/planColor';

/** Whether {@link PlanCategoryIcon} draws anything for this plan. */
export function hasPlanCategoryIcon(
  payment: Pick<PlannedPayment, 'color' | 'categoryId' | 'transactionType'>,
  categories: Category[],
) {
  return Boolean(getPlanColor(payment) || getPlanCategoryIcon(payment, categories) || payment.transactionType === 'transfer');
}

const SIZES = {
  sm: { box: 'w-5 h-5', emoji: 'text-[11px]', icon: 11 },
  lg: { box: 'w-9 h-9', emoji: 'text-lg', icon: 18 },
} as const;

/**
 * Icon of a plan's category in the list of plans and on the dashboard banners,
 * like the markers in the calendar: the category's emoji (an arrow for a
 * transfer) on a circle of the plan's own colour. A plan without a colour
 * shows its icon on a neutral circle; a plan with neither a colour nor an
 * icon shows nothing.
 */
export default function PlanCategoryIcon({
  payment,
  categories,
  size = 'sm',
  muted = false,
  className = '',
}: {
  payment: Pick<PlannedPayment, 'color' | 'categoryId' | 'transactionType'>;
  categories: Category[];
  size?: keyof typeof SIZES;
  muted?: boolean;
  className?: string;
}) {
  if (!hasPlanCategoryIcon(payment, categories)) return null;
  const color = getPlanColor(payment);
  const emoji = getPlanCategoryIcon(payment, categories);
  const isTransfer = payment.transactionType === 'transfer';

  const dims = SIZES[size];
  return (
    <span
      data-testid="plan-category-icon"
      data-plan-color={color ?? undefined}
      aria-hidden="true"
      style={color ? { backgroundColor: color } : undefined}
      className={`inline-flex ${dims.box} shrink-0 items-center justify-center rounded-full leading-none ${color
        ? 'text-white ring-1 ring-white/70'
        : 'bg-theme-surface text-current ring-1 ring-black/5'} ${muted ? 'opacity-50 grayscale' : ''} ${className}`}
    >
      {emoji
        ? <span className={dims.emoji}>{emoji}</span>
        : isTransfer
          ? <ArrowLeftRight size={dims.icon} strokeWidth={3} />
          : null}
    </span>
  );
}
