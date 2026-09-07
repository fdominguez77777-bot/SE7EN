import type { NextConfig } from 'next'

const apiTarget = (process.env.API_REWRITE_TARGET ?? 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
)

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ]
  },
}

export default nextConfig
