import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Emit a self-contained .next/standalone bundle (server.js + traced
  // node_modules) for a small production Docker image. See Dockerfile.
  output: 'standalone',

  // Confine file tracing to this project. Without this, Next walks up to the
  // parent Dalgo/ workspace (multiple lockfiles) and mis-roots the standalone
  // output, nesting server.js under an unexpected subpath.
  outputFileTracingRoot: path.resolve(__dirname),

  // Pin the Turbopack workspace root to this project so it doesn't try to scan
  // the entire Dalgo/ workspace (DDP_backend, webapp, webapp_v2…), which causes
  // 30+ second compiles and timeouts.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
