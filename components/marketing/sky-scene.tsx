import { cn } from "@/lib/utils";

/**
 * Decorative animated scene for the home page: sky with drifting clouds, a light aircraft
 * crossing it and an airfield below. Day colours in light mode, a starry night in dark mode.
 * Pure SVG + CSS (animations in globals.css, `.sky-*`), so no files to load and no CSP changes;
 * motion stops for people who ask for reduced motion.
 */
export function SkyScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className={cn("sky-scene block size-full", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:#4f9fe8] dark:[stop-color:#0a1330]" />
          <stop offset="0.75" className="[stop-color:#cfe8ff] dark:[stop-color:#35386e]" />
        </linearGradient>
        <g id="sky-cloud">
          <ellipse cx="60" cy="34" rx="60" ry="18" />
          <circle cx="42" cy="24" r="20" />
          <circle cx="72" cy="18" r="24" />
          <circle cx="96" cy="30" r="16" />
        </g>
      </defs>

      <rect width="800" height="500" fill="url(#sky-gradient)" />

      {/* Day: sun. Night: moon and stars. */}
      <g className="dark:hidden">
        <circle cx="640" cy="105" r="70" fill="#fff4c2" opacity="0.35" />
        <circle cx="640" cy="105" r="38" fill="#ffe27a" />
      </g>
      <g className="hidden dark:inline">
        <circle cx="640" cy="100" r="30" fill="#eef1ff" />
        <circle cx="654" cy="90" r="27" fill="#0f1a3c" />
        {STARS.map(([x, y, r], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill="#fff"
            className={i % 3 === 0 ? "sky-twinkle" : undefined}
            style={{ animationDelay: `${(i % 5) * 0.7}s` }}
          />
        ))}
      </g>

      {/* Far clouds, slow. Each layer holds its clouds twice so the loop is seamless. */}
      <g className="sky-drift-slow fill-white/70 dark:fill-indigo-200/15">
        {[0, 800].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <use href="#sky-cloud" transform="translate(40 60) scale(0.7)" />
            <use href="#sky-cloud" transform="translate(330 120) scale(0.55)" />
            <use href="#sky-cloud" transform="translate(560 40) scale(0.6)" />
          </g>
        ))}
      </g>

      {/* The aircraft: flies across, bobbing gently, propeller turning. */}
      <g className="sky-fly">
        <g className="sky-bob">
          <g transform="translate(0 150) scale(3)">
            <Aircraft />
          </g>
        </g>
      </g>

      {/* Near clouds, faster, in front of the aircraft now and then. */}
      <g className="sky-drift-fast fill-white/90 dark:fill-indigo-100/20">
        {[0, 800].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <use href="#sky-cloud" transform="translate(120 230) scale(1.1)" />
            <use href="#sky-cloud" transform="translate(520 270) scale(0.9)" />
          </g>
        ))}
      </g>

      <Airfield />
    </svg>
  );
}

/** A high-wing single-engine aeroplane seen from the side, nose to the right (≈ 64 × 24). */
function Aircraft() {
  return (
    <g>
      {/* tail fin and stabiliser */}
      <path d="M3 13 L1 2 L6 2 L13 11 Z" className="fill-primary" />
      <path d="M0 12 L13 12 L13 14 L0 14 Z" className="fill-primary" />
      {/* fuselage */}
      <path
        d="M2 13 L10 11 L44 9.5 C52 9.5 58 11 61 13 C58 15 52 16.5 44 16.5 L10 15.5 Z"
        className="fill-white dark:fill-slate-200"
      />
      <path d="M12 13.2 L58 13.2" className="stroke-primary" strokeWidth="0.9" />
      {/* wing and strut */}
      <path d="M22 7.5 L47 7.5 L47 9.6 L22 9.6 Z" className="fill-primary" />
      <path d="M31 15 L38 9.6" className="stroke-slate-500" strokeWidth="0.7" />
      {/* windows */}
      <path d="M38 10.4 L47 10.2 L51 12.3 L40 12.4 Z" className="fill-sky-900 dark:fill-sky-950" />
      {/* landing gear */}
      <path d="M28 16 L27 20 M51 16 L51 19.5" className="stroke-slate-600" strokeWidth="0.8" />
      <circle cx="27" cy="20.5" r="1.8" className="fill-slate-700" />
      <circle cx="51" cy="20" r="1.5" className="fill-slate-700" />
      {/* spinner and spinning propeller */}
      <circle cx="61.5" cy="13" r="1.4" className="fill-slate-500" />
      <ellipse cx="62.5" cy="13" rx="0.8" ry="7" className="sky-prop fill-slate-500/70" />
    </g>
  );
}

/** Hills, a runway with its centre line, a hangar and a windsock. */
function Airfield() {
  return (
    <g>
      <path
        d="M0 395 C120 360 220 385 330 372 C450 358 560 390 800 360 L800 500 L0 500 Z"
        className="fill-emerald-300 dark:fill-emerald-950"
      />
      <path
        d="M0 430 C160 405 300 420 420 412 C560 402 680 425 800 410 L800 500 L0 500 Z"
        className="fill-emerald-400 dark:fill-emerald-900"
      />
      <path
        d="M318 500 L482 500 L416 404 L384 404 Z"
        className="fill-slate-500 dark:fill-slate-700"
      />
      <path
        d="M400 410 L400 500"
        className="stroke-white/90 dark:stroke-slate-300/70"
        strokeWidth="3"
        strokeDasharray="10 9"
      />
      <path d="M312 500 L380 404 M488 500 L420 404" className="stroke-white/80" strokeWidth="1.5" />
      {/* hangar */}
      <path
        d="M96 424 L96 392 Q130 370 164 392 L164 424 Z"
        className="fill-slate-300 dark:fill-slate-600"
      />
      <path
        d="M112 424 L112 402 L148 402 L148 424 Z"
        className="fill-slate-500 dark:fill-slate-800"
      />
      {/* windsock */}
      <path
        d="M612 420 L612 380"
        className="stroke-slate-600 dark:stroke-slate-400"
        strokeWidth="2"
      />
      <path d="M612 381 L640 385 L640 391 L612 393 Z" className="sky-windsock fill-orange-500" />
      <path
        d="M621 382.3 L621 392.4 M630 383.6 L630 391.8"
        className="stroke-white"
        strokeWidth="2"
      />
    </g>
  );
}

const STARS: [number, number, number][] = [
  [40, 40, 1.2],
  [95, 110, 0.9],
  [150, 30, 1.4],
  [210, 80, 1],
  [270, 20, 1.1],
  [320, 95, 0.8],
  [380, 45, 1.3],
  [440, 120, 0.9],
  [490, 30, 1.1],
  [540, 150, 0.8],
  [720, 40, 1.2],
  [760, 130, 1],
  [700, 190, 0.8],
  [60, 190, 0.9],
  [250, 160, 1],
  [590, 60, 0.9],
];
