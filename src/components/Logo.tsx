"use client";
/* Coloca tus imágenes en public/logos/<carpeta>/<slug>.png */
export default function Logo({ folder, slug, size = 48 }: { folder: string; slug: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/logos/${folder}/${slug}.png`} alt="" width={size} height={size} style={{ objectFit: "contain" }}
      onError={(e) => ((e.currentTarget.style.visibility = "hidden"))} />
  );
}
