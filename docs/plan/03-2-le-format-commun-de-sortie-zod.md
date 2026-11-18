<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 3.2 Le format commun de sortie (Zod)

Extrait de `src/lib/schemas.ts` :

```ts
export const Affirmation = z.object({
  id: z.string().regex(/^(INV|CPT|JUR|CON|CLI|JUG)-\d{1,3}$/), // ex. INV-3
  texte: z.string().max(300),
  valeur: z.number().nullable(),            // le nombre lui-même, ou null
  unite: z.string().max(30).nullable(),     // "€/mois", "%", "établissements"…
  type: z.enum(["fait", "estimation", "donnee_utilisateur"]),
  source_url: z.string().url().nullable(),  // obligatoire si type = "fait"
  extrait: z.string().max(400).nullable(),  // passage exact de la page
  base: z.array(z.string()).default([]),    // ids de faits, obligatoire si "estimation"
});

export const Argument = z.object({
  id: z.string(),                           // ex. INV-A1
  sens: z.enum(["pour", "contre"]),
  these: z.string().max(280),
  appuis: z.array(z.string()).min(1),       // ids d'affirmations
});

export const Vote = z.object({
  note: z.number().min(0).max(10).multipleOf(0.5),
  verdict: z.enum(["GO", "PIVOT", "NO-GO"]),
  raison_principale: z.string().max(280),
  appuis: z.array(z.string()).min(2),
});

export const JurorBrief = z.object({
  agent: z.enum(["investisseur", "comptable", "juriste", "concurrent", "cliente"]),
  affirmations: z.array(Affirmation).min(3).max(15),
  arguments: z.array(Argument).min(2).max(6),
  vote: Vote,
  replique: z.string().max(400),            // la phrase « en personnage » pour la salle
  lacunes: z.array(z.string()).max(5),
  alertes: z.array(z.string()).max(5),      // ex. instruction suspecte trouvée dans une page
});
```

Règles ajoutées en `superRefine` (contrôles du code) :
- `type = "fait"` ⇒ `source_url` et `extrait` non nuls ;
- `type = "estimation"` ⇒ `base` non vide, et chaque id de `base` est un « fait » vérifié ;
- **cohérence note / verdict** : GO ⇒ note ≥ 6 ; NO-GO ⇒ note ≤ 4,5 ; PIVOT ⇒ 3 ≤ note ≤ 7,5 ;
- chaque nombre écrit dans `these`, `replique`, `raison_principale` doit correspondre (tolérance ±1 %) à la `valeur` d'une affirmation citée dans `appuis` (voir garde-fou G4).

Chaque personnage ajoute des champs propres (ci-dessous).
