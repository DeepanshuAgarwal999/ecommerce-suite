import type { SocialPlatform } from '@/features/footer/types';

/**
 * Minimal, dependency-free glyphs for the footer's social row — lucide-react
 * ships no brand icons, and pulling in a whole icon-pack for six links isn't
 * worth it. Simplified outline marks, not exact brand reproductions.
 */
const paths: Record<SocialPlatform, string> = {
  facebook:
    'M14 9h2V6h-2c-1.66 0-3 1.34-3 3v2H9v3h2v6h3v-6h2.1l.4-3H14V9.5c0-.3.2-.5.5-.5H15' /* f mark */,
  instagram:
    'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM17.5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  twitter:
    'M3 3l7.5 9.5L3.4 21H6l6-6.8 4.8 6.8H21l-7.9-10L20.6 3H18l-5.5 6.2L8 3H3z',
  linkedin:
    'M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9.98h4V21H3zM9.5 9.98H13v1.5h.06c.49-.9 1.69-1.85 3.48-1.85 3.72 0 4.4 2.3 4.4 5.3V21h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.74 0-2 1.35-2 2.75V21h-4z',
  pinterest:
    'M12 2a10 10 0 0 0-3.64 19.32c-.05-.82-.1-2.08.02-2.98.11-.8.72-5.13.72-5.13s-.18-.37-.18-.91c0-.85.5-1.49 1.11-1.49.52 0 .78.4.78.87 0 .53-.34 1.33-.51 2.07-.15.62.31 1.12.92 1.12 1.1 0 1.95-1.16 1.95-2.84 0-1.48-1.07-2.52-2.6-2.52-1.77 0-2.81 1.33-2.81 2.7 0 .53.2 1.11.46 1.42a.19.19 0 0 1 .04.18c-.05.2-.16.62-.18.71-.03.12-.1.15-.22.09-.84-.39-1.36-1.6-1.36-2.58 0-2.1 1.53-4.03 4.4-4.03 2.31 0 4.1 1.65 4.1 3.84 0 2.29-1.44 4.14-3.45 4.14-.67 0-1.31-.35-1.52-.76l-.41 1.58c-.15.58-.56 1.3-.83 1.75A10 10 0 1 0 12 2z',
  youtube:
    'M23 12s0-3.2-.41-4.73a3 3 0 0 0-2.12-2.13C18.9 4.73 12 4.73 12 4.73s-6.9 0-8.47.41A3 3 0 0 0 1.41 7.27C1 8.8 1 12 1 12s0 3.2.41 4.73a3 3 0 0 0 2.12 2.13c1.57.41 8.47.41 8.47.41s6.9 0 8.47-.41a3 3 0 0 0 2.12-2.13C23 15.2 23 12 23 12zM9.75 15.5v-7l6 3.5z',
};

const labels: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
};

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const d = paths[platform];
  if (!d) return null;

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={d} />
    </svg>
  );
}

export function socialLabel(platform: SocialPlatform): string {
  return labels[platform] ?? platform;
}
