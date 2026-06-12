"use client";

import { useId } from "react";

export function HoneycombPattern() {
  const id = useId().replace(/:/g, "");
  const depthPatternId = `honeycomb-depth-${id}`;
  const gridPatternId = `honeycomb-grid-${id}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={depthPatternId}
          x="0"
          y="0"
          width="336"
          height="256"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="70,14 126,46 126,110 70,142 14,110 14,46"
            fill="#FEF3C7"
            fillOpacity="0.42"
          />
          <polygon
            points="266,102 322,134 322,198 266,230 210,198 210,134"
            fill="#D1FAE5"
            fillOpacity="0.24"
          />
          <polygon
            points="168,150 210,174 210,222 168,246 126,222 126,174"
            fill="#E0F2FE"
            fillOpacity="0.28"
          />
        </pattern>
        <pattern
          id={gridPatternId}
          x="0"
          y="0"
          width="56"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="28,2 52,16 52,48 28,62 4,48 4,16"
            fill="none"
            stroke="#FACC15"
            strokeOpacity="0.2"
            strokeWidth="0.9"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${depthPatternId})`} />
      <rect width="100%" height="100%" fill={`url(#${gridPatternId})`} />
    </svg>
  );
}
