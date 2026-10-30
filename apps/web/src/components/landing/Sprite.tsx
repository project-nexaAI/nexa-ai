// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="nx-mark" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="16" fill="#141414" />
        <circle cx="32" cy="33" r="19" fill="#2A2A2C" />
        <rect x="11" y="27" width="42" height="8" rx="4" fill="#FF5A1F" />
      </symbol>
      <symbol id="nx-x" viewBox="0 0 24 24">
        <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L8.3 3.9H6.5L17.8 20Z" />
      </symbol>
    </svg>
  )
}
