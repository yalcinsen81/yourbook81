// Çizgi ikonlar (24×24, 1.7 kalınlık; Lucide benzeri). Tek renk; rengi `currentColor`'dan alır.

const PATHS = {
  plus: "M12 5v14M5 12h14",
  milestone: "M12 3l9 9-9 9-9-9z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  outdent: "M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4",
  indent: "M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M19 12l-7 7-7-7",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  unlink: "M15 7h2a5 5 0 0 1 0 10h-2M9 17H7A5 5 0 0 1 7 7h2M3 3l18 18",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  file: "M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6",
  open: "M3 7h6l2 2h10v10H3zM3 7V5h6",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  share: "M12 16V4M7 9l5-5 5 5M5 14v6h14v-6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  plug: "M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4",
  chevron: "M9 6l6 6-6 6",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6",
  chart: "M4 20V4M4 20h16M8 16l4-5 3 3 5-7",
  gantt: "M4 6h9M7 12h10M10 18h10",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  zoomIn: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6M11 8v6",
  zoomOut: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  paste: "M9 4h6v3H9zM8 5H5v16h14V5h-3M9 12h6M9 16h4",
  duplicate: "M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  level: "M4 20h16M7 16V9M12 16V5M17 16v-4M4 9h6M14 12h6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  columns: "M4 5h16v14H4zM10 5v14M15 5v14",
  report: "M6 3h9l4 4v14H6zM9 17v-4M12 17v-7M15 17v-2",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  risk: "M12 4L2.5 20h19zM12 10v4.5M12 17.5h.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  filter: "M4 5h16l-6 7.5V19l-4 2v-8.5z",
  sort: "M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3",
  close: "M6 6l12 12M18 6L6 18",
  brand: "M5 7h8M8 12h9M11 17h8",
  template: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  crosshair: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v4M12 17v4M3 12h4M17 12h4",
  outline: "M4 5h7M8 12h12M8 19h12M5 5v14h3M5 12h3",
  group: "M4 4h16v5H4zM9 14h11M9 19h11M6 9v10h3M6 14h3",
  note: "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5",
  timeline: "M3 12h18M7 8v8M12 5v14M17 9v6",
  inactive: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  split: "M3 12h6M15 12h6M12 5v14M7 9l2 3-2 3M17 9l-2 3 2 3",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  fillDown: "M5 4h14v6H5zM12 12v8M8 16l4 4 4-4",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
