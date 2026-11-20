// Génération des formats JSON depuis les schémas Zod (plan v3.0 ; prompts v3 §13).
// En mode plugin, le format remplace <!-- FORMAT --> dans le prompt. En mode API, c'est l'API qui impose
// le format (zodOutputFormat + messages.parse, étape 4) : rien n'est ajouté au prompt.

import { z } from "zod";
import { PHASES_PAR_AGENT, schemaSortie, type AgentId, type Phase } from "../../../prompts/agents.config";

const BRUIT = new Set(["$schema", "additionalProperties"]);

function allege(n: unknown): unknown {
  if (Array.isArray(n)) return n.map(allege);
  if (n && typeof n === "object") {
    return Object.fromEntries(Object.entries(n).filter(([k]) => !BRUIT.has(k)).map(([k, v]) => [k, allege(v)]));
  }
  return n;
}

/** Format JSON lisible d'un schéma. Les `.describe()` deviennent les explications de chaque champ. */
export function formatPourPrompt(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any", io: "output" });
  return "```json\n" + JSON.stringify(allege(json), null, 2) + "\n```";
}

const TITRE_PHASE: Record<Phase, string> = {
  IDENTIFICATION: "IDENTIFICATION",
  IDENTIFICATION_COMPLEMENT: "IDENTIFICATION_COMPLEMENT (même format)",
  MISE_EN_ETAT: "MISE_EN_ETAT",
  INSTRUCTION: "INSTRUCTION",
  LECTURE: "LECTURE",
  DEBAT: "DEBAT (le champ `tour` vaut celui du message MISSION)",
  REVOTE: "REVOTE",
  CORRECTION: "CORRECTION",
};

/** Un format par phase que joue l'agent. Les phases au format identique ne sont écrites qu'une fois. */
export function formatsPourAgent(agent: AgentId): string {
  const vus = new Map<string, Phase[]>();
  for (const phase of PHASES_PAR_AGENT[agent]) {
    const format = formatPourPrompt(schemaSortie(agent, phase, "plugin"));
    vus.set(format, [...(vus.get(format) ?? []), phase]);
  }
  const unique = vus.size === 1;
  const sections = [...vus.entries()].map(([format, phases]) =>
    unique ? format : `### Format de la phase ${phases.map((p) => TITRE_PHASE[p]).join(" et ")}\n${format}`,
  );
  return sections.join("\n\n");
}
