import React from 'react';

export const CoinStack = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Bottom Coin */}
    <ellipse cx="13" cy="17" rx="7" ry="3" />
    <path d="M6 17v-2.5" />
    <path d="M20 17v-2.5" />
    
    {/* Middle Coin */}
    <ellipse cx="9" cy="12" rx="7" ry="3" />
    <path d="M2 12v-2.5" />
    <path d="M16 12v-2.5" />

    {/* Top Coin */}
    <ellipse cx="13" cy="7" rx="7" ry="3" />
  </svg>
);
