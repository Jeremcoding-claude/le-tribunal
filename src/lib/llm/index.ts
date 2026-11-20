// Point d'entrée de la couche LLM : MOCK par défaut (config.ts : MOCK_MODE n'est pas « false »).
import { GUARDRAILS } from "../guardrails/config";
import { creerClientReel, type OptionsClientReel } from "./client";
import { creerClientMock, type OptionsMock } from "./mock";
import type { LlmClient } from "./types";

export function getClient(opts: { mock?: boolean; reel?: OptionsClientReel; mockOptions?: OptionsMock } = {}): LlmClient {
  const mock = opts.mock ?? GUARDRAILS.mock;
  return mock ? creerClientMock(opts.mockOptions) : creerClientReel(opts.reel);
}

export type { CallAgentParams, CallAgentResult, LlmClient, LlmEvent, ToolEvidence, Citation } from "./types";
export { LlmError } from "./types";
