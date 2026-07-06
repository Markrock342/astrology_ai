"use client";

/** User profile photo with initials fallback (Google URL or uploaded image). */
export function UserAvatar({
  name,
  image,
  size = 36,
  className = "",
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ? `รูปโปรไฟล์ ${name}` : "รูปโปรไฟล์"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--foreground)] ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
      aria-hidden={!name}
    >
      {initials}
    </div>
  );
}
