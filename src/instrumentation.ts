// Exécuté une fois au démarrage du serveur Next.js. Le test littéral du runtime est le motif documenté par Next.js : il permet
// d'exclure le code Node.js (SQLite) de la compilation « Edge ». Seule exception à « process.env n'est lu que dans env.ts », limitée
// à NEXT_RUNTIME (aucune donnée de l'utilisateur) et vérifiée par tests/guardrails/garde-fous.test.ts.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
