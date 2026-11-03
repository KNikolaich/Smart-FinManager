// src/components/icons/PlasmaBallIcon.tsx
// "Прогноз" tab icon: a plasma (crystal) ball on a stand, drawn in the
// lucide style (24x24 grid, currentColor stroke) so it sits next to the
// other navigation icons and follows their size/strokeWidth props.

import type { SVGProps } from 'react';

type PlasmaBallIconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number;
  strokeWidth?: number;
};

export function PlasmaBallIcon({ size = 24, strokeWidth = 2, ...props }: PlasmaBallIconProps) {
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
      {/* glass sphere */}
      <circle cx="12" cy="9" r="7" />
      {/* stand */}
      <path d="M9.2 15.4 8 21h8l-1.2-5.6" />
      {/* plasma core and filaments */}
      <circle cx="12" cy="9" r="0.6" fill="currentColor" />
      <g strokeWidth={strokeWidth * 0.5}>
        <path d="M12 8.2 11.3 6.6l.9-1.2-.4-1.4" />
        <path d="M11.3 8.6 9.6 8.1 8.9 6.7 7.4 6.2" />
        <path d="M12.7 8.6l1.7-.5.7-1.4 1.5-.5" />
        <path d="M11.4 9.6 9.9 10.9l-.2 1.4-1.3.9" />
        <path d="M12.6 9.6l1.5 1.3.2 1.4 1.3.9" />
      </g>
    </svg>
  );
}
