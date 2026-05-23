import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project so it doesn't try to scan
  // the entire Dalgo/ workspace (DDP_backend, webapp, webapp_v2…), which causes
  // 30+ second compiles and timeouts.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
