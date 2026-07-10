/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep a live dev server isolated from `next build`. Both commands default to
  // `.next`; running a production build while dev is open otherwise overwrites
  // the dev route manifests and leaves the live server returning Next's 404.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The app spawns local agent CLIs and reads ~/.codex/auth.json on the server.
  // pptxgenjs / pdf-lib pull in Node built-ins; keep them external to the bundle.
  experimental: {
    serverComponentsExternalPackages: ["pptxgenjs", "pdf-lib"],
  },
};

export default nextConfig;
