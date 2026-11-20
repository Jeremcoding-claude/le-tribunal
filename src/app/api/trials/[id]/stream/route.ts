import { getStream } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return getStream(req, (await params).id, obtenirService());
}
