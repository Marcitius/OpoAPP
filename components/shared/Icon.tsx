import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  today: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  study: "M12 5C8 3 4 4 3 5v14c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-2-6-2-9 0v14",
  review:
    "M7 3h12a2 2 0 0 1 2 2v12M3 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm4 7 2 2 4-4",
  progress: "M4 20V10m6 10V5m6 15v-7m5 7H2",
  more: "M5 11h.01M12 11h.01M19 11h.01",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  back: "m14 6-6 6 6 6",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  folder:
    "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  psych: "M4 5h16v14H4V5Zm4 4h2m4 0h2m-8 5h2m4 0h2",
  account: "M8 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-3a8 8 0 0 1 16 0v3",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  upload: "M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6",
  plus: "M12 4v16M4 12h16",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2",
};
export default function Icon({
  name,
  size = 22,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.study} />
    </svg>
  );
}
