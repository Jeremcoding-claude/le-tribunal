import { protege } from "@/lib/server/acces";
import { getTrials, postTrial } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const POST = protege((req) => postTrial(req, obtenirService()));
export const GET = protege(() => getTrials(obtenirService()));
