import React from 'react';

interface SipersipLogoProps {
  compact?: boolean;
}

export const SipersipLogo: React.FC<SipersipLogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <svg
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="40" height="40" rx="10" fill="#E8F1FF" />
        <path
          d="M8 13C8 11.3431 9.34315 10 11 10H16.5L19 12.5H29C30.6569 12.5 32 13.8431 32 15.5V27.5C32 29.1569 30.6569 30.5 29 30.5H11C9.34315 30.5 8 29.1569 8 27.5V13Z"
          fill="#0D47A1"
        />
        <rect x="12" y="14" width="16" height="10" rx="1.5" fill="#FFFFFF" />
        <path
          d="M10 17.5C10 16.3954 10.8954 15.5 12 15.5H28C29.1046 15.5 30 16.3954 30 17.5V28C30 29.3807 28.8807 30.5 27.5 30.5H12.5C11.1193 30.5 10 29.3807 10 28V17.5Z"
          fill="#2E6BD6"
        />
        <path d="M15 21H25M15 24.5H21.5" stroke="#E8F1FF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight text-[#0D47A1] leading-none whitespace-nowrap">
            SIPERSIP
          </div>
          <div className="text-[11px] font-medium text-[#6B7280] mt-1 whitespace-nowrap">
            Sistem Penyimpanan Arsip
          </div>
        </div>
      )}
    </div>
  );
};
