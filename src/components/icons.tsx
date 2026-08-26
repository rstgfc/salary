import React from "react";

export type IconName =
  | "unit" | "allowance" | "query" | "recalc" | "rolling" | "trash"
  | "catalog" | "calc" | "key" | "help" | "power"
  | "on" | "retire" | "stop" | "search" | "close" | "check"
  | "warn" | "info" | "lan" | "clock" | "chevR" | "copy" | "user"
  | "shield" | "sum" | "grid" | "plus" | "del" | "bolt" | "eye" | "sun" | "moon" | "download";

const P: Record<IconName, React.ReactNode> = {
  unit: (<><rect x="3" y="8" width="12" height="12" rx="1.5" /><path d="M15 11h4a1 1 0 0 1 1 1v8h-5M6.5 11.5v.01M9.5 11.5v.01M6.5 14.5v.01M9.5 14.5v.01M6.5 17.5v.01M9.5 17.5v.01M7 8V5.5A1.5 1.5 0 0 1 8.5 4h3A1.5 1.5 0 0 1 13 5.5V8" /></>),
  allowance: (<><path d="M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3z" /><path d="M8 3v4h8V3M9 12l3 3 3-3M12 15v3.5M9.2 15h5.6M9.2 17.6h5.6" /></>),
  query: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M11 8.2v2.8l2 1.6" /></>),
  recalc: (<><path d="M20 12a8 8 0 1 1-2.34-5.66M20 3v4.5h-4.5" /><path d="M12 8v4l2.5 2" /></>),
  rolling: (<><path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6" /><path d="M8 13l2.5 2.5L16 10" /></>),
  trash: (<><path d="M4 7h16M10 4h4M6.5 7l.8 12.2A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.8L17.5 7M10 11v6M14 11v6" /></>),
  catalog: (<><ellipse cx="12" cy="5.5" rx="7" ry="2.8" /><path d="M5 5.5v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6M5 11.5v6c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-6" /></>),
  calc: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5v3M8.5 17.5h.01M12 17.5h.01" /></>),
  key: (<><circle cx="8" cy="15.5" r="4" /><path d="M10.8 12.7L19 4.5M15.5 8l2.5 2.5M18 5.5L20 7.5" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9M12 17.2v.01" /></>),
  power: (<><path d="M12 3v8" /><path d="M17.5 6.5a8 8 0 1 1-11 0" /></>),
  on: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.8" /></>),
  retire: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.2" /></>),
  stop: (<><circle cx="12" cy="12" r="8.5" /><path d="M15 9l-6 6M9 9l6 6" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>),
  close: (<><path d="M6 6l12 12M18 6L6 18" /></>),
  check: (<><path d="M4.5 12.5l5 5L19.5 7" /></>),
  warn: (<><path d="M12 3.5l9.5 16.5H2.5L12 3.5zM12 10v4.5M12 17.5v.01" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.01" /></>),
  lan: (<><path d="M2.5 9.3a14.5 14.5 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.6 15.6a5.5 5.5 0 0 1 6.8 0M12 19v.01" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>),
  chevR: (<><path d="M9 5.5l6.5 6.5L9 18.5" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>),
  shield: (<><path d="M12 3l7.5 2.8v5.4c0 4.8-3.2 8-7.5 9.8-4.3-1.8-7.5-5-7.5-9.8V5.8L12 3z" /><path d="M9 11.8l2.2 2.2 4-4.4" /></>),
  sum: (<><path d="M17 5H7.5l5 7-5 7H17" /></>),
  grid: (<><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  del: (<><path d="M5 12h14" /></>),
  bolt: (<><path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12l1-8z" /></>),
  eye: (<><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>),
  sun: (<><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>),
  moon: (<><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" /></>),
  download: (<><path d="M12 4v10M7.5 10.5L12 15l4.5-4.5" /><path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" /></>),
};

export function Icon({ name, size = 15, className = "", sw = 1.7 }: {
  name: IconName; size?: number; className?: string; sw?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5l8 3v5.6c0 5.2-3.4 8.7-8 10.4-4.6-1.7-8-5.2-8-10.4V5.5l8-3z" fill="url(#lg1)" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      <path d="M9 8.5h6M9 8.5l3 3.4 3-3.4M12 11.9v4.6M9.8 13.6h4.4M10.3 15.3h3.4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="lg1" x1="4" y1="3" x2="20" y2="21">
          <stop stopColor="#0a84ff" /><stop offset="1" stopColor="#5ac8fa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
