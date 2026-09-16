import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH ?? '',
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  redirects: async () => [{ source: '/', destination: '/dashboard', permanent: false }]
}

export default nextConfig
