/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for production Docker builds (smaller image,
  // includes only the files needed to run the server).
  output: 'standalone',
  async headers() {
    return [
      {
        // Self-hosted fonts (src/app/fonts.css). Filenames carry the Google
        // Fonts version and are never overwritten, so they can be cached
        // forever, like the hashed files next/font used to emit.
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig


