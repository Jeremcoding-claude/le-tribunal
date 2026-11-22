import { protege } from "@/lib/server/acces";
import { deleteTrial, getTrial } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

type Ctx = { params: Promise<{ id: string }> };

export const GET = protege(async (_req: Request, { params }: Ctx) => getTrial((await params).id, obtenirService()));
export const DELETE = protege(async (_req: Request, { params }: Ctx) => deleteTrial((await params).id, obtenirService()));
