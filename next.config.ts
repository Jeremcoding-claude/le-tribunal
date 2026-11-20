import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 est un module natif : il reste hors du bundle serveur.
  serverExternalPackages: ["better-sqlite3"],
  // cacheComponents (activé par create-next-app) est incompatible avec les routes SSE et `runtime` : retiré à l'étape 10.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
