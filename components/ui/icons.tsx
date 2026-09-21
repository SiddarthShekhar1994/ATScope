import type { SVGProps } from 'react';

/**
 * A handful of hand-drawn 16px line icons. Used sparingly, always paired with
 * a text label; never as decoration on every card.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: P) {
  return { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...rest };
}

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.5l6 11H2l6-11z" />
    <path d="M8 6.5v3M8 12h.01" />
  </svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 8H3M7 4L3 8l4 4" />
  </svg>
);
export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);
export const IconDoc = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 1.5h5.5L13 5v9.5H4z" />
    <path d="M9.5 1.5V5H13M6 8h4M6 10.5h4" />
  </svg>
);
export const IconScan = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
    <path d="M2 8h12" strokeDasharray="1.5 2" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V3.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 12.5v1h11v-1" />
  </svg>
);
export const IconKeyboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
    <path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6" />
  </svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10V2.5M4.5 6L8 2.5 11.5 6M2.5 12.5v1h11v-1" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);
export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1" />
  </svg>
);
export const IconHistory = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 8a5.5 5.5 0 105.5-5.5A5.5 5.5 0 003.5 5" />
    <path d="M2.5 2.5v3h3M8 5v3l2 1.5" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h6.5a3 3 0 010 6H6" />
    <path d="M5.5 3.5L3 6l2.5 2.5" />
  </svg>
);
export const IconDot = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);
export const IconColumns = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="2.5" width="4.5" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="4.5" height="11" rx="1" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h10" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
