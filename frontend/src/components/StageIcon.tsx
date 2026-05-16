interface Props {
  name: 'referral' | 'surgical' | 'allied' | 'graph';
  className?: string;
}

export default function StageIcon({ name, className = 'h-5 w-5' }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
  switch (name) {
    case 'referral':
      return (
        <svg {...common}>
          {/* arrow into a target */}
          <circle cx="16" cy="12" r="5" />
          <circle cx="16" cy="12" r="1.6" fill="currentColor" />
          <path d="M3 12h6" />
          <path d="M7 9l-2.5 3L7 15" />
        </svg>
      );
    case 'surgical':
      return (
        <svg {...common}>
          {/* scalpel + crosshair */}
          <path d="M5 19l8-8 3 3-8 8H5z" />
          <path d="M13 11l5-5 2 2-5 5" />
          <circle cx="18" cy="6" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'allied':
      return (
        <svg {...common}>
          {/* heart with pulse */}
          <path d="M3.5 11c-.5-3 1.5-5.5 4.5-5.5 1.7 0 3 .9 4 2.2 1-1.3 2.3-2.2 4-2.2 3 0 5 2.5 4.5 5.5-.7 4-7 9-8.5 9.5C10.5 20 4.2 15 3.5 11z" />
          <path d="M7 12h2l1.5-3 2 6 1.5-3h3" />
        </svg>
      );
    case 'graph':
      return (
        <svg {...common}>
          {/* nodes connected through a center */}
          <circle cx="5" cy="5" r="1.6" />
          <circle cx="19" cy="5" r="1.6" />
          <circle cx="5" cy="19" r="1.6" />
          <circle cx="19" cy="19" r="1.6" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M6.4 6.4L10 10M17.6 6.4L14 10M6.4 17.6L10 14M17.6 17.6L14 14" />
        </svg>
      );
  }
}
