interface BrandMarkProps {
  size?: number;
}

/**
 * Four bars of shrinking height: the same cash flow, worth less the further
 * out it lands — discounting, as a glyph.
 */
export function BrandMark({ size = 22 }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="3" width="3.6" height="16" rx="1" fill="currentColor" />
      <rect x="6.6" y="6" width="3.6" height="13" rx="1" fill="currentColor" opacity="0.78" />
      <rect x="12.2" y="9" width="3.6" height="10" rx="1" fill="currentColor" opacity="0.56" />
      <rect x="17.8" y="11.5" width="3.2" height="7.5" rx="1" fill="currentColor" opacity="0.36" />
    </svg>
  );
}
