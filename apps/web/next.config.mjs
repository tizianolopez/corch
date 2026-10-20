// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@corchetes/ui', '@corchetes/core', '@corchetes/crypto'],
  reactStrictMode: true,
}

export default nextConfig
