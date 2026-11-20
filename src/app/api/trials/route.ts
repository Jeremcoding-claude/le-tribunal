import { postTrial } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const runtime = "nodejs";

export const POST = (req: Request) => postTrial(req, obtenirService());
