/* Shared inline SVG icons, ported from the maquette. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  ...props,
});

export const OverviewIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

export const LeadsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="5" r="2.5" />
    <path d="M1 13c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" />
    <circle cx="12" cy="7" r="2" />
    <path d="M10 13c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
  </svg>
);

export const EmailIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 4l6 5 6-5" />
    <rect x="2" y="4" width="12" height="9" rx="1.5" />
  </svg>
);

export const CampaignIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 8h12M8 2v12M5 5l6 6M11 5l-6 6" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 12l3-5 3 3 2-4 4 6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 8l3 3 7-7" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 1.75, ...p })}>
    <path d="M10 12L6 8l4-4" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.5v3.5M8 5v1" />
  </svg>
);

export const SpinnerIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 1.75, ...p })} className="spin">
    <circle cx="8" cy="8" r="6" strokeDasharray="22" strokeDashoffset="12" />
  </svg>
);

export const CircleIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 1.75, ...p })}>
    <circle cx="8" cy="8" r="6" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.75} {...p}>
    <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 1.75, ...p })}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 1.75, ...p })}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="5" r="2.5" />
    <path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" />
  </svg>
);

export const CardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="M2 6.5h12" />
  </svg>
);

export const GearIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 3H4v10h6M7 8h7M11.5 5.5L14 8l-2.5 2.5" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="11" rx="1.5" />
    <path d="M5 1.5v3M11 1.5v3M2 6.5h12" />
  </svg>
);

export const CartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M1.5 2h2l1.2 7.5h7l1.3-5.5H4" />
    <circle cx="6" cy="13" r="1" />
    <circle cx="12" cy="13" r="1" />
  </svg>
);
