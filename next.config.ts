import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization.minimize = false
    }
    return config
  },
  serverExternalPackages: [
    '@nestjs/common',
    '@nestjs/config',
    '@nestjs/core',
    '@nestjs/jwt',
    '@nestjs/passport',
    '@nestjs/platform-express',
    '@nestjs/swagger',
    '@nestjs/typeorm',
    'bcrypt',
    'class-transformer',
    'class-validator',
    'express',
    'passport',
    'pg',
    'typeorm',
  ],
}

export default nextConfig
