/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app spawns local agent CLIs and reads ~/.codex/auth.json on the server.
  // pptxgenjs / pdf-lib pull in Node built-ins; keep them external to the bundle.
  experimental: {
    serverComponentsExternalPackages: ["pptxgenjs", "pdf-lib"],
  },
};

export default nextConfig;
