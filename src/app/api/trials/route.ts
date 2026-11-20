import { getTrials, postTrial } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const POST = (req: Request) => postTrial(req, obtenirService());
export const GET = () => getTrials(obtenirService());
