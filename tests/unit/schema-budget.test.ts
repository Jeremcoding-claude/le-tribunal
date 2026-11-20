import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SCHEMAS_API } from "@/lib/schemas";

// « Budget de schéma » (plan, étape 2, [S27]) : les sorties structurées de l'API limitent, par requête,
// les champs facultatifs (24 au plus) et les champs à types multiples, null compris (16 au plus).
// On parcourt le JSON Schema complet (chaque usage d'un sous-schéma compte, par prudence).
const MAX_FACULTATIFS = 24;
const MAX_TYPES_MULTIPLES = 16;

type Noeud = Record<string, unknown>;
interface Compte {
  facultatifs: number;
  typesMultiples: number;
}

const estTypeMultiple = (n: Noeud): boolean => Array.isArray(n.type) || Array.isArray(n.anyOf) || Array.isArray(n.oneOf);

function parcourir(n: unknown, c: Compte): void {
  if (Array.isArray(n)) {
    n.forEach((x) => parcourir(x, c));
    return;
  }
  if (n === null || typeof n !== "object") return;
  const noeud = n as Noeud;
  const props = noeud.properties as Record<string, Noeud> | undefined;
  if (props) {
    const requis = new Set((noeud.required as string[] | undefined) ?? []);
    for (const [nom, sous] of Object.entries(props)) {
      if (!requis.has(nom)) c.facultatifs++;
      if (estTypeMultiple(sous)) c.typesMultiples++;
    }
  }
  for (const valeur of Object.values(noeud)) parcourir(valeur, c);
}

export function budgetDeSchema(schema: z.ZodType): Compte {
  const json = z.toJSONSchema(schema, { io: "output", reused: "inline", unrepresentable: "any" });
  const c: Compte = { facultatifs: 0, typesMultiples: 0 };
  parcourir(json, c);
  return c;
}

describe("budget de schéma des sorties structurées", () => {
  const entrees = Object.entries(SCHEMAS_API);

  it("liste les schémas envoyés à l'API", () => {
    expect(entrees.length).toBeGreaterThanOrEqual(11);
  });

  for (const [nom, schema] of entrees) {
    it(`${nom} : au plus ${MAX_FACULTATIFS} champs facultatifs et ${MAX_TYPES_MULTIPLES} champs à types multiples`, () => {
      const c = budgetDeSchema(schema as z.ZodType);
      expect(c.facultatifs, `${nom} : ${c.facultatifs} champs facultatifs`).toBeLessThanOrEqual(MAX_FACULTATIFS);
      expect(c.typesMultiples, `${nom} : ${c.typesMultiples} champs à types multiples`).toBeLessThanOrEqual(MAX_TYPES_MULTIPLES);
    });
  }

  it("le compteur voit bien un champ facultatif et un nullable (test du test)", () => {
    const test = z.object({ a: z.string().optional(), b: z.number().nullable(), c: z.string() });
    // a est facultatif (non requis) ; b est un nullable, donc un champ à types multiples ; c ne compte pas.
    expect(budgetDeSchema(test)).toEqual({ facultatifs: 1, typesMultiples: 1 });
    expect(budgetDeSchema(z.object({ x: z.string().nullable().optional() }))).toEqual({ facultatifs: 1, typesMultiples: 1 });
  });

  it("aucun schéma envoyé à l'API n'a de champ facultatif", () => {
    for (const [nom, schema] of entrees) {
      expect(budgetDeSchema(schema as z.ZodType).facultatifs, nom).toBe(0);
    }
  });
});
