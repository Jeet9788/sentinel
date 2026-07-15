import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /**
   * The model runs in a Python function, not in Node. In development it is a
   * uvicorn process on :8000, reached by rewriting /api/py/* to it. In production
   * the Python function is a sibling Vercel function and the routing is handled
   * at the platform level in vercel.json, not here — a Next.js rewrite cannot
   * reach a separate Python function.
   */
  async rewrites() {
    if (!isDev) return [];
    return [{ source: "/api/py/:path*", destination: "http://127.0.0.1:8000/api/py/:path*" }];
  },

  // PGlite ships a WASM Postgres. Bundling it would be pointless (production uses
  // Neon) and breaks the build, so it stays an external require.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
