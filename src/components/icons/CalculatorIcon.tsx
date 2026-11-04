// src/components/icons/CalculatorIcon.tsx
// "Кредитный калькулятор" icon: a pocket calculator with a display and a
// key grid (the right column has a tall "=" key). Drawn in the lucide style
// (24x24 grid, currentColor stroke) so it follows the size/strokeWidth props
// and the text colour of its parent, in both light and dark themes.

import type { SVGProps } from 'react';

type CalculatorIconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number;
  strokeWidth?: number;
};

export function CalculatorIcon({ size = 24, strokeWidth = 2, ...props }: CalculatorIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* body */}
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      {/* display */}
      <rect x="7.5" y="5" width="9" height="3.5" rx="0.8" />
      {/* keys */}
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="15.5" cy="12" r="1" />
        <circle cx="8.5" cy="15.25" r="1" />
        <circle cx="12" cy="15.25" r="1" />
        <circle cx="8.5" cy="18.5" r="1" />
        <circle cx="12" cy="18.5" r="1" />
        {/* tall "=" key */}
        <rect x="14.5" y="14.25" width="2" height="5.25" rx="1" />
      </g>
    </svg>
  );
}
