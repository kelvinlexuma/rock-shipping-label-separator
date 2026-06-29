import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these out of the bundle and load from node_modules at runtime.
  // @napi-rs/canvas has a native .node binary; zxing-wasm ships a .wasm file —
  // bundling either breaks them.
  serverExternalPackages: ['unpdf', '@napi-rs/canvas', 'zxing-wasm'],
  // Force the native binary and the wasm into the convert function's Lambda.
  // (File tracing doesn't reliably follow the runtime-resolved .node / .wasm,
  // which is what silently broke earlier PDF work in production.)
  outputFileTracingIncludes: {
    '/api/convert': [
      './node_modules/@napi-rs/canvas-linux-x64-gnu/*.node',
      './node_modules/zxing-wasm/dist/reader/*.wasm',
    ],
  },
};

export default nextConfig;
