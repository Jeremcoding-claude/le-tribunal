import { protege } from "@/lib/server/acces";
import { getReport } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const GET = protege(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => getReport((await params).id, obtenirService()));
