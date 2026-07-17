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

  /**
   * Baseline security headers on every route. HSTS comes from Vercel; these add
   * clickjacking and MIME-sniffing protection and stop referrer leakage. A
   * strict CSP is deliberately not set — Next's inline runtime and the WebGL
   * shader would need a nonce pipeline for little gain on a public demo.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
