<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 3. Les 6 personnages (+ le greffier)

### 3.0 Les prénoms, les voix et la salle (v3.0)

Chaque personnage a un prénom, un rôle, une voix. Les prénoms servent aux phrases libres et à la salle d'audience. Les identifiants (`appuis`, `vise`, `cite`) restent des ids, et **un prénom n'est jamais une preuve**.

| Prénom | Rôle | Id | Voix | Vote |
|---|---|---|---|---|
| **Nadia** | Le Juge (§3.9) | `JUG` | Solennelle, impartiale, sévère. Vouvoie. « Attendu que… Par ces motifs… » | **Non** |
| **Victor** | L'Investisseur (§3.4) | `INV` | Business angel pressé, phrases courtes. Vouvoie. « Montrez-moi le marché. » | Oui |
| **Léa** | La Comptable (§3.5) | `CPT` | Méticuleuse, pince-sans-rire. Numérote tout : « Ligne 4 : … » | Oui |
| **Claire** | La Juriste (§3.6) : signale, ne conseille pas | `JUR` | Prudente, conditionnel. Cite le texte avant de parler. « Je ne vous donne pas un avis ; je vous lis le texte. » | Oui |
| **Marco** | Le Concurrent (§3.7) | `CON` | Rival stratège, provocateur. Tutoie. « Moi, je te copie en … semaines. Regarde. » | Oui |
| **La Cliente** | Incarne une cliente réaliste de la cible (§3.8). Prénom fictif créé à chaque procès. Cas de référence : **Sandrine** | `CLI` | Celle de sa persona : familière, pressée, concrète. Première personne. | Oui |

Le **Greffier** (§3.3) n'a pas de prénom et ne vote pas. Dans les tableaux de ce plan, « le Juge », « le Comptable », etc. désignent ces mêmes personnages.

**Règles des prénoms (décision du 19/11/2026) :**
1. **Source unique : `prompts/agents.config.ts`** (prénom, rôle et id de chaque agent fixe). Aucun prénom n'est écrit en dur dans un prompt : `loader.ts` injecte la salle (les 6 prénoms fixes et leur rôle) à la place du marqueur `<!-- PRENOMS -->`.
2. **Le prénom de la Cliente** est créé par le Greffier-rédacteur (P1c). Il est donné dans le message MISSION des phases où elle parle, jamais dans le prompt système.
3. **Validité** : le prénom de la Cliente n'est ni l'un des cinq prénoms fixes (Nadia, Victor, Léa, Claire, Marco), ni un prénom dont l'initiale est V, L, C, M ou N. Sinon la persona est invalide (rejet, une relance du rédacteur). Le code applique la règle dans `src/lib/trial/persona-prenom.ts`.
4. **Aucun accessoire, couleur ni décor de la salle dans un prompt** : ils vivent dans `src/components/salle/personnages.ts` (§12.4).
5. **Fichiers du moteur concernés** : `persona-prenom.ts` (règle 3), `replique-cliente.ts` (chiffres permis dans les répliques de la Cliente : G4), `prononce.ts` (texte fixe de Nadia au verdict : §4.2). Ces trois fichiers sont des **candidats à fusionner** avec `tally.ts`, `state-machine.ts` (extrait) et `Proposition` de `schemas.ts` ; ils sont intégrés aux étapes 2, 5 et 6.

**Tests de la règle 1, 2 et 4** (étape 3, `tests/guardrails/prenoms-prompts.test.ts`) : (a) `<!-- PRENOMS -->` est remplacé par les prénoms de `agents.config.ts`, et aucun prénom n'apparaît en dur dans `prompts/*.md` ; (b) aucun mot d'accessoire ou de décor (perruque, haut-de-forme, robot, table, pièces…) dans `prompts/` ; (c) le prénom de la Cliente est dans la MISSION et absent du prompt système.
