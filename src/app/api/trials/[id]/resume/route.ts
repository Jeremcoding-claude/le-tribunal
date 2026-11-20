import { postResume } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return postResume((await params).id, obtenirService());
}
