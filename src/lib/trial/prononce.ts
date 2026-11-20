// Nadia « prononce » le verdict avec un TEXTE FIXE (plan v3.0, §4.2, hypothèse à valider). Le code remplit les nombres, tous
// pris dans le résultat de tally.ts : Nadia ne calcule ni n'écrit elle-même aucune note ni aucun verdict.

import type { ResultatTally } from "./tally";

const fr = (n: number) => n.toFixed(1).replace(".", ",");
const voix = (n: number) => `${n} voix`;

export function prononcer(t: ResultatTally): string {
  if (t.verdictJury === "AJOURNE") {
    return "Attendu que le quorum n'est pas réuni, le tribunal ajourne le procès. Aucun verdict n'est rendu : le rapport est partiel.";
  }
  const total = t.repartition.GO + t.repartition.PIVOT + t.repartition["NO-GO"];
  const lignes: string[] = [];
  if (t.revoteSansQuorum) {
    lignes.push(`Attendu que le revote n'a pas réuni le quorum, le tribunal se fonde sur le premier vote (${voix(t.repartition[t.verdictJury as "GO"])} sur ${total} pour ${t.verdictJury}).`);
    lignes.push(`Note du premier vote : ${fr(t.noteAvant!)}/10.`);
  } else {
    lignes.push(`Attendu que le jury, à ${voix(t.repartition[t.verdictJury as "GO"])} sur ${total}, rend le verdict ${t.verdictJury}.`);
    lignes.push(`Note finale : ${fr(t.noteApres!)}/10, contre ${fr(t.noteAvant!)}/10 avant la correction du plan.`);
  }
  if (t.divergence) lignes.push(`Le verdict suit la majorité ; la moyenne des notes diverge.`);
  if (t.juryDivise) lignes.push("Le jury est divisé.");
  if (t.consensusSuspect) lignes.push("Le consensus est suspect et mérite examen.");
  lignes.push(`Par ces motifs : ${t.phrase}`);
  return lignes.join(" ");
}
