// Dikonversi mekanis dari docs/html-design/nexa-1.html oleh scripts/html-to-jsx.mjs; sekarang diedit manual.
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      {/* Logo dari desainer (docs/html-design/logo/nexa-logo.png), dipakai apa adanya: hanya dipotong, latar hitam jadi transparan, dan diubah ukurannya. */}
      <symbol id="nx-mark" viewBox="0 0 64 64">
        <image href="/nexa-mark.png" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
      </symbol>
      <symbol id="nx-x" viewBox="0 0 24 24">
        <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L8.3 3.9H6.5L17.8 20Z" />
      </symbol>
    </svg>
  )
}
