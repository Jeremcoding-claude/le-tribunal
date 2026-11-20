import type { Metadata } from "next";
import Pied from "@/components/accueil/Pied";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le Tribunal",
  description: "Six agents jugent ton idée de business : chiffres sourcés, vote secret, débat, plan corrigé, verdict.",
};

// Aucune police externe : la pile système, servie par le navigateur (§12.4 : rien de tiers au chargement).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#120c08] text-stone-100">
        {children}
        <Pied />
      </body>
    </html>
  );
}
