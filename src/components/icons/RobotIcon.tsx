// src/components/icons/RobotIcon.tsx
// Icon author: zero_wing

import React from 'react';

export const RobotIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Main Speech Bubble Shape */}
    <path 
      d="M87.5 45C87.5 25.1177 70.7107 9 50 9C29.2893 9 12.5 25.1177 12.5 45C12.5 53.6841 15.7656 61.6429 21.2 67.8L18.5 83L33.4 78C38.3 80.2 44 81.5 50 81.5C70.7107 81.5 87.5 65.3823 87.5 45Z" 
      fill="currentColor" 
    />
    
    {/* Headphones/Side parts */}
    <rect x="5" y="38" width="8" height="30" rx="4" fill="currentColor" />
    <rect x="87" y="38" width="8" height="30" rx="4" fill="currentColor" />
    
    {/* Antennas */}
    <rect x="8" y="22" width="4" height="20" rx="2" fill="currentColor" />
    <rect x="88" y="22" width="4" height="20" rx="2" fill="currentColor" />
    
    {/* Face White Area */}
    <rect x="22" y="28" width="56" height="34" rx="17" fill="white" />
    
    {/* Smiling Eyes */}
    <path 
      d="M32 45C32 41 40 41 40 45" 
      stroke="currentColor" 
      strokeWidth="6" 
      strokeLinecap="round" 
    />
    <path 
      d="M60 45C60 41 68 41 68 45" 
      stroke="currentColor" 
      strokeWidth="6" 
      strokeLinecap="round" 
    />
    
    {/* Smile */}
    <path 
      d="M47 55C47 58 53 58 53 55" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
    />
  </svg>
);
