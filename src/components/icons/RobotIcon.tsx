// src/components/icons/RobotIcon.tsx
// Icon author: zero_wing

import React from 'react';

export const RobotIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 48 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Head Outer Frame */}
    <rect x="8" y="10" width="32" height="24" rx="10" />
    
    {/* Small top bump */}
    <path d="M20 10V8C20 6.89543 20.8954 6 22 6H26C27.1046 6 28 6.89543 28 8V10" />

    {/* Antennas */}
    <path d="M11 10L10 4" />
    <circle cx="10" cy="4" r="2.5" fill="none" stroke="currentColor" />
    <path d="M37 10L38 4" />
    <circle cx="38" cy="4" r="2.5" fill="none" stroke="currentColor" />
    
    {/* Eyes */}
    <circle cx="18" cy="20" r="3.5" fill="none" stroke="currentColor" />
    <circle cx="30" cy="20" r="3.5" fill="none" stroke="currentColor" />
    
    {/* Mouth (rounded slot) */}
    <rect x="18" y="27" width="12" height="3" rx="1.5" stroke="currentColor" fill="none" />
    
    {/* Side Earpieces (rectangular) */}
    <rect x="4" y="16" width="4" height="12" rx="1.5" />
    <rect x="40" y="16" width="4" height="12" rx="1.5" />
    
    {/* Boom Mic Arm */}
    <path d="M42 28C42 36 38 40 28 40" strokeWidth="2.5" />
    {/* Mic Tip */}
    <rect x="22" y="38" width="6" height="4" rx="2" stroke="currentColor" fill="none"/>
    
    {/* Chat Bubble at bottom left */}
    <path d="M6 38H18V46H12L6 48V38Z" strokeWidth="2.2" />
    <path d="M9 41H15" strokeWidth="1.8" />
    <path d="M9 44H13" strokeWidth="1.8" />
  </svg>
);
