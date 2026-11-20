import { getReport } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return getReport((await params).id, obtenirService());
}
