import { protege } from "@/lib/server/acces";
import { postResume } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const POST = protege(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => postResume((await params).id, obtenirService()));
