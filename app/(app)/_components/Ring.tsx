/**
 * Ring — the signature closing-progress ring of the Elasticoach design system.
 *
 * Pure SVG, no data dependency: give it a value and a goal. The arc fills
 * clockwise from 12 o'clock and eases to its target; the global
 * prefers-reduced-motion rule neutralizes the transition for users who opt out.
 * `color` defaults to the (white-label) brand, so a coach's --brand re-skins it.
 */
type RingProps = {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
  /** Any CSS color — pass a token like "var(--water)". Defaults to brand. */
  color?: string;
  /** Center content (the big number + unit). */
  children?: React.ReactNode;
  /** Accessible label; falls back to the percentage. */
  label?: string;
};

export function Ring({
  value,
  goal,
  size = 88,
  stroke = 9,
  color = "var(--brand)",
  children,
  label,
}: RingProps) {
  const pct = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const pctText = Math.round(pct * 100);

  return (
    <div
      className="relative grid flex-none place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${pctText}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {children}
      </div>
    </div>
  );
}
