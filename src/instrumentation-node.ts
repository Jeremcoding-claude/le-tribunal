// Démarrage Node.js : une configuration douteuse ARRÊTE le démarrage (plan §11.3), puis le journal affiche un résumé sans secret.
// L'ouverture de la base applique les migrations Drizzle ; un échec de migration arrête aussi le démarrage.

import { lireEnv, resumeEnv } from "./lib/env";
import { obtenirService } from "./lib/server/instance";

console.log(`[tribunal] ${resumeEnv(lireEnv())}`);
obtenirService();
