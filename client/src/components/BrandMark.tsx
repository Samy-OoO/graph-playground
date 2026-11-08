/** The app's logo: three connected nodes. Decorative, because the name sits right beside it. */
export function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M6 21 L14 7 L22 21 Z" strokeLinejoin="round" />
      </g>
      <g fill="currentColor">
        <circle cx="6" cy="21" r="3.2" />
        <circle cx="14" cy="7" r="3.2" />
        <circle cx="22" cy="21" r="3.2" />
      </g>
    </svg>
  );
}