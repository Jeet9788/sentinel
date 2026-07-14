import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /**
   * The model runs in a Python function, not in Node. In development that is a
   * uvicorn process on :8000; in production it is a Vercel Python function in the
   * same deployment. Both are reached at /api/py/*, so nothing else in the app
   * has to know which one it is talking to.
   */
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: isDev ? "http://127.0.0.1:8000/api/py/:path*" : "/api/",
      },
    ];
  },

  // PGlite ships a WASM Postgres. Bundling it would be pointless (production uses
  // Neon) and breaks the build, so it stays an external require.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
