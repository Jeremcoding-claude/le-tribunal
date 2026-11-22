import { protege } from "@/lib/server/acces";
import { postAnswers } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const POST = protege(async (req: Request, { params }: { params: Promise<{ id: string }> }) => postAnswers(req, (await params).id, obtenirService()));
