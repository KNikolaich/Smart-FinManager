// src/components/icons/RobotIcon.tsx
// Icon author: zero_wing

import React from 'react';

export const RobotIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Head */}
    <rect x="6" y="8" width="12" height="9" rx="3" />
    
    {/* Eyes */}
    <circle cx="10" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
    
    {/* Antennas */}
    <path d="M9 8L8 4" />
    <circle cx="8" cy="3.5" r="1" fill="currentColor" stroke="none" />
    <path d="M15 8L16 4" />
    <circle cx="16" cy="3.5" r="1" fill="currentColor" stroke="none" />
    
    {/* Side Earpieces */}
    <rect x="4" y="11" width="2" height="4" rx="1" />
    <rect x="18" y="11" width="2" height="4" rx="1" />
    
    {/* Headset Mic */}
    <path d="M19 13C19 17 16 19 13 19" />
    <rect x="10" y="18" width="3" height="2" rx="1" fill="currentColor" stroke="none"/>
    
    {/* Chat bubble at bottom left */}
    <path d="M2 18H8V22H4L2 24V18Z" strokeWidth="1.2"/>
    <path d="M3.5 20H6.5" strokeWidth="1"/>
    <path d="M3.5 21.5H5.5" strokeWidth="1"/>
  </svg>
);
