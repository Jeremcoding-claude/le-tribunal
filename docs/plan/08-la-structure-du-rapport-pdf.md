<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 8. La structure du rapport PDF

| Page | Contenu | D'où viennent les données |
|---|---|---|
| 1. Couverture-verdict | Idée (version neutre), date, **phrase finale en très grand** (« Lance. » / « Modifie ton plan. » / « Ne lance pas. »), **note avant → note après** (ex. format « 3,4 → 5,6 / 10 »), quorum (« 5/5 votes valides »), **répartition du jury**, mention de **divergence** (ex. « verdict GO à 3 voix sur 5, mais note 5,8/10 »), coût du procès ; bandeau **« Prix non communiqué : comptes partiels »** si le prix manque | `tally.ts`, `usage.ts` |
| 2. En bref | 3 raisons principales du verdict ; 3 conditions pour lancer ; ce qui a changé entre les deux votes | Objections classées, `Ruling` |
| 3. Le dossier | **Identification** (statut, correspondances au registre, activité NAF, commune, écarts, avec sources) ; CaseFile neutre ; mots retirés ; persona de la Cliente | Pièces du greffe, Greffier |
| 4–8. Une page par juré | Réplique en personnage ; affirmations clés avec numéro de source ; vote 1 et revote ; a changé d'avis ? pourquoi ; lacunes | `JurorBrief`, `Revote` |
| Page du Comptable | **Tableau L1 à L14**, chaque ligne avec sa formule en clair, ses entrées et leurs sources ; « non calculable » quand une entrée manque ; origine du prix (saisie, site officiel, réponse à la question, non communiqué) | `ledger.ts` |
| Page du Juriste | Tableau des risques (gravité, texte officiel, mesure) + « signalement, pas avis juridique » | Juriste |
| Le débat | 4 à 6 échanges marquants (contestations les plus citées) | `DebateTurn` |
| L'arbitrage | Contradictions tranchées (« Attendu que… ») ; **plan avant / après** en deux colonnes ; « Par ces motifs » | `Ruling` |
| Méthode | Comment la note est calculée (moyenne, quorum, majorité stricte, égalité départagée par la moyenne, divergence) ; écart-type ; « jury divisé » (≥ 1,5) ou « consensus suspect » (≤ 0,5) si besoin ; le verdict est prononcé par Nadia avec un texte fixe dont le code fournit les nombres | `tally.ts` |
| Annexe A — Sources | Liste numérotée : titre, URL, date de consultation, extrait cité | Vérificateur |
| Annexe B — Transparence | Chiffres rejetés (nombre et raison), alertes d'injection, modèles utilisés, tokens et recherches par phase | Vérificateur, `usage.ts` |
| Dernière page | **Avertissement** : « Ce rapport est produit par des modèles d'IA à partir de sources publiques. Il ne constitue ni un conseil financier, ni un conseil juridique. Vérifiez les sources avant toute décision. » | Fixe |

Règle d'or : **aucun nombre dans le PDF** sans numéro de source ou référence à une ligne du Comptable. Un test l'impose (étape 8).

---
