import { protege } from "@/lib/server/acces";
import { getStream } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const GET = protege(async (req: Request, { params }: { params: Promise<{ id: string }> }) => getStream(req, (await params).id, obtenirService()));
