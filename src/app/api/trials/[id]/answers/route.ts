import { postAnswers } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return postAnswers(req, (await params).id, obtenirService());
}
