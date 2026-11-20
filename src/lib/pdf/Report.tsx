// Rendu du rapport PDF (@react-pdf/renderer, MIT) : sans navigateur, côté serveur ou CLI. Police standard Helvetica : aucune
// ressource externe. Le contenu vient de rapport.ts (modèle vérifié) ; ce fichier ne fait que le mettre en page.

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import type { Etat } from "../trial/phases/contexte";
import { construireRapport, verifierRapport, type Ligne, type ModeleRapport, type PageRapport } from "./rapport";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a", lineHeight: 1.4 },
  titrePage: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 14, borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 4 },
  ligne: { marginBottom: 5 },
  titre: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  grand: { fontSize: 30, fontFamily: "Helvetica-Bold", marginVertical: 18 },
  note: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  alerte: { backgroundColor: "#fff3cd", padding: 5, marginBottom: 5 },
  refs: { fontSize: 7, color: "#555" },
  tableau: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#999" },
  rangee: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#bbb", paddingVertical: 2 },
  entete: { fontFamily: "Helvetica-Bold", backgroundColor: "#eee" },
  cellule: { flex: 1, paddingHorizontal: 3, fontSize: 8 },
  pied: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#777", flexDirection: "row", justifyContent: "space-between" },
});

const styleLigne = (x: Ligne) => [s.ligne, ...(x.style === "grand" ? [s.grand] : x.style === "titre" ? [s.titre] : x.style === "note" ? [s.note] : x.style === "alerte" ? [s.alerte] : [])];

function PageDuRapport({ p }: { p: PageRapport }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.titrePage}>{p.titre}</Text>
      {p.lignes.map((x, i) => (
        <Text key={i} style={styleLigne(x)}>
          {x.texte}
          {x.refs.length > 0 ? <Text style={s.refs}>{`  [${x.refs.join(" ")}]`}</Text> : null}
        </Text>
      ))}
      {p.tableau ? (
        <View style={s.tableau}>
          <View style={[s.rangee, s.entete]}>
            {p.tableau.entetes.map((h, i) => (
              <Text key={i} style={s.cellule}>
                {h}
              </Text>
            ))}
          </View>
          {p.tableau.lignes.map((r, i) => (
            <View key={i} style={s.rangee} wrap={false}>
              {r.cellules.map((c, j) => (
                <Text key={j} style={s.cellule}>
                  {c}
                  {j === r.cellules.length - 1 && r.refs.length > 0 ? <Text style={s.refs}>{`  [${r.refs.join(" ")}]`}</Text> : null}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.pied} fixed>
        <Text>Le Tribunal : ni conseil financier, ni conseil juridique</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

export function Rapport({ modele }: { modele: ModeleRapport }) {
  return (
    <Document title="Le Tribunal : rapport" author="Le Tribunal" creator="Le Tribunal" producer="Le Tribunal">
      {modele.pages.map((p, i) => (
        <PageDuRapport key={i} p={p} />
      ))}
    </Document>
  );
}

export class RapportInvalide extends Error {}

/** Construit le modèle, REFUSE de produire un PDF qui enfreint la règle d'or, puis le rend. */
export async function genererPdf(etat: Etat, opts: { date?: string } = {}): Promise<Buffer> {
  const modele = construireRapport(etat, { date: opts.date ?? new Date().toISOString().slice(0, 10) });
  const violations = verifierRapport(modele);
  if (violations.length) {
    throw new RapportInvalide(`Rapport refusé : ${violations.slice(0, 3).map((v) => `${v.page} : ${v.raison} (« ${v.texte.slice(0, 60)} »)`).join(" ; ")}`);
  }
  return renderToBuffer(<Rapport modele={modele} />);
}

export async function ecrirePdf(etat: Etat, chemin: string, opts: { date?: string } = {}): Promise<number> {
  const buf = await genererPdf(etat, opts);
  writeFileSync(chemin, buf);
  return buf.length;
}
