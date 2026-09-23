/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server Actions are used for admin login and future upload/device
  // mutations (Parts 2–6). Body size limit raised beyond the Next.js
  // default so multi-megabyte device file uploads don't get rejected
  // before reaching our own MAX_FILE_SIZE check in lib/storage.ts.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
