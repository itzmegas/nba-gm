"use client";

const PLAYER_HEADSHOT_FALLBACK = "/player-silhouette.svg";

interface PlayerHeadshotProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function PlayerHeadshot({ src, alt, className, loading = "lazy" }: PlayerHeadshotProps) {
  return (
    // biome-ignore lint/performance/noImgElement: player headshots come from external providers
    <img
      src={src || PLAYER_HEADSHOT_FALLBACK}
      alt={alt}
      className={className}
      loading={loading}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = PLAYER_HEADSHOT_FALLBACK;
      }}
    />
  );
}
