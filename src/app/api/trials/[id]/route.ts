import { deleteTrial, getTrial } from "@/lib/server/handlers";
import { obtenirService } from "@/lib/server/instance";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return getTrial((await params).id, obtenirService());
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteTrial((await params).id, obtenirService());
}
