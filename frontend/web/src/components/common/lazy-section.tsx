/**
 * Skips layout/style/paint work for a section until it is near the viewport.
 *
 * The homepage is a long, growing stack of independent sections (category
 * strip, product rails, admin-curated shelves) each with their own images.
 * Without this, the browser does full rendering work for every section on
 * every scroll frame even when most of them are off-screen - that is what
 * "laggy while scrolling" actually is on a page shaped like this. This is the
 * browser-native fix (content-visibility, Baseline since 2024) rather than a
 * JS virtualisation library: zero bundle cost, and every new section - including
 * ones a future admin adds to the Home Sections CMS - gets it for free just by
 * being wrapped the same way, no per-section tuning required.
 *
 * `minHeight` is an estimate for `contain-intrinsic-size`, used only before the
 * section has ever been rendered - it prevents the page from jumping/collapsing
 * when a section scrolls into view for the first time. It does not need to be
 * exact; the real height takes over the moment the browser actually renders it.
 */
export function LazySection({
  children,
  minHeight = 400,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <div style={{ contentVisibility: 'auto', containIntrinsicSize: `0 ${minHeight}px` }}>
      {children}
    </div>
  );
}
