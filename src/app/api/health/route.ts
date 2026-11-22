import { getHealth } from "@/lib/server/acces";
import { obtenirService } from "@/lib/server/instance";

export const dynamic = "force-dynamic";
export const GET = () => getHealth(() => obtenirService().lister());
