import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 24): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })

export const IconHome = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
export const IconDumbbell = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>
export const IconCamera = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
export const IconChart = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 15l3-4 3 2 5-7" /></svg>
export const IconSettings = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
export const IconPlay = ({ size, ...p }: P) => <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M7 4.5v15a1 1 0 0 0 1.5.87l12-7.5a1 1 0 0 0 0-1.74l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
export const IconCheck = ({ size, ...p }: P) => <svg {...base(size)} {...p} strokeWidth={3}><path d="m5 12 5 5L20 7" /></svg>
export const IconChevronRight = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
export const IconChevronLeft = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m15 6-6 6 6 6" /></svg>
export const IconChevronDown = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m6 9 6 6 6-6" /></svg>
export const IconX = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
export const IconPlus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
export const IconMinus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12h14" /></svg>
export const IconSwap = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>
export const IconSkip = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 5l9 7-9 7zM18 5v14" /></svg>
export const IconTimer = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></svg>
export const IconFlame = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 22c4.4 0 7-2.8 7-6.5 0-3-2-5.2-3.5-7-.4 2-1.2 3-2.5 3.5.5-3-1-6.5-4-9 .3 3-1 5-3 7.5A7.6 7.6 0 0 0 5 15.5C5 19.2 7.6 22 12 22z" /></svg>
export const IconLock = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
export const IconEye = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
export const IconEyeOff = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.2A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 3.9M6.6 6.6C3.7 8.6 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1" /></svg>
export const IconTrophy = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></svg>
export const IconBody = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="4.5" r="2.5" /><path d="M6 10c2-1.5 10-1.5 12 0M9 10l-1 11M15 10l1 11M9.5 15h5" /></svg>
export const IconScale = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 9a6 6 0 0 1 8 0M12 12l2-3" /></svg>
export const IconFork = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 3v7a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 5-2 8h2v10" /></svg>
export const IconArrowUp = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
export const IconArrowDown = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12l7 7 7-7" /></svg>
export const IconRotate = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
export const IconImage = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></svg>
export const IconInfo = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
export const IconCalendar = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
export const IconDownload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3v12M6 11l6 6 6-6M4 21h16" /></svg>
export const IconUpload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 21V9M6 13l6-6 6 6M4 3h16" /></svg>
export const IconPause = ({ size, ...p }: P) => <svg {...base(size)} {...p} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
export const IconMoon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>
export const IconDrop = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
export const IconZap = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
