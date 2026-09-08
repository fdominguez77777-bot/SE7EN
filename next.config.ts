import type { NextConfig } from 'next'

function publicApiTarget(): string | null {
  const configured = (process.env.API_REWRITE_TARGET ?? '').replace(/\/$/, '').trim()
  if (configured && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/i.test(configured)) {
    return configured
  }
  if (process.env.VERCEL) {
    return null
  }
  return 'http://127.0.0.1:3000'
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const apiTarget = publicApiTarget()
    if (!apiTarget) {
      return { beforeFiles: [], afterFiles: [], fallback: [] }
    }
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiTarget}/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
