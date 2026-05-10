interface CandleLogoProps {
  size?: { width: number; height: number };
  className?: string;
}

export function CandleLogo({
  size = { width: 26, height: 20 },
  className,
}: CandleLogoProps) {
  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox="0 0 42 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g className="logo-c1">
        <line
          x1={8}
          y1={10}
          x2={8}
          y2={14}
          className="bull-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <rect
          x={5}
          y={14}
          width={6}
          height={8}
          rx={0.8}
          className="bull-fill"
        />
        <line
          x1={8}
          y1={22}
          x2={8}
          y2={26}
          className="bull-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
      <g className="logo-c2">
        <line
          x1={21}
          y1={7}
          x2={21}
          y2={11}
          className="bear-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <rect
          x={18}
          y={11}
          width={6}
          height={11}
          rx={0.8}
          className="bear-fill"
        />
        <line
          x1={21}
          y1={22}
          x2={21}
          y2={26}
          className="bear-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
      <g className="logo-c3">
        <line
          x1={34}
          y1={4}
          x2={34}
          y2={9}
          className="bull-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <rect
          x={31}
          y={9}
          width={6}
          height={13}
          rx={0.8}
          className="bull-fill"
        />
        <line
          x1={34}
          y1={22}
          x2={34}
          y2={26}
          className="bull-stroke"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
