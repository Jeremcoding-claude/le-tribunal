import { getReport } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return getReport((await params).id, obtenirService());
}
