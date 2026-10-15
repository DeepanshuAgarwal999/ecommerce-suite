import { themeOverrideCss } from '../presets';
import type { StoreTheme } from '../types';

/** Injects the live theme's admin colour overrides. Renders nothing when the
 *  theme has none - the preset palette in global.css then applies as-is. */
export function OccasionStyle({ theme }: { theme: StoreTheme | null }) {
  const css = themeOverrideCss(theme?.colors ?? null);
  if (!css) return null;
  return <style id="occasion-colors" dangerouslySetInnerHTML={{ __html: css }} />;
}
