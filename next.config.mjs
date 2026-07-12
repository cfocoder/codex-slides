/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local and packaged builds serve project/community imagery directly. This
  // avoids a platform-specific sharp binary in the Electron runtime.
  images: { unoptimized: true },
  // Electron packages the traced Node server plus static/public assets. The
  // same build remains deployable as the normal web application.
  output: "standalone",
  // Keep a live dev server isolated from `next build`. Both commands default to
  // `.next`; running a production build while dev is open otherwise overwrites
  // the dev route manifests and leaves the live server returning Next's 404.
  distDir: process.env.CODEX_SLIDES_DIST_DIR
    || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  typescript: {
    // The development runner isolates build output by port and supplies an
    // ignored per-port config so concurrent Web/Desktop sessions never rewrite
    // the checked-in tsconfig.json.
    tsconfigPath: process.env.CODEX_SLIDES_TSCONFIG_PATH || "tsconfig.json",
  },
  // The app spawns local agent CLIs and reads ~/.codex/auth.json on the server.
  // pptxgenjs / pdf-lib pull in Node built-ins; keep them external to the bundle.
  experimental: {
    serverComponentsExternalPackages: ["pptxgenjs", "pdf-lib"],
    // Never trace local user content or transient developer state into a
    // distributable standalone server. Desktop builds create their own empty
    // data root under Electron's appData directory at runtime.
    outputFileTracingExcludes: {
      "*": [
        "./data/**/*",
        "./dist/**/*",
        "./.next-dev/**/*",
        "./.claude/**/*",
      ],
    },
  },
};

export default nextConfig;
