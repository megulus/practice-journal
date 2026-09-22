/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phase A: the whole point of the spike. Capacitor serves a directory of
  // static files, so the Next app has to export to one.
  output: 'export',

  // Phase A finding: without this, `next build` still succeeds but emits
  // `<img src="/_next/image?url=...">`, which nothing serves inside the app.
  images: { unoptimized: true },
}

export default nextConfig
