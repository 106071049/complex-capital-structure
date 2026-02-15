/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/complex-capital',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
