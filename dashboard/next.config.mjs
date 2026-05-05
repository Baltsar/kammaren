/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// /watcher/terms och /watcher/privacy är ○ (Static) och bakar in
// TERMS.md / PRIVACY.md vid build-tid via lib/markdown.ts. Inga
// runtime-läsningar behövs på Vercel, så vi behöver inte inkludera
// repo-rot-filerna i serverless trace-inputs.

export default nextConfig;
