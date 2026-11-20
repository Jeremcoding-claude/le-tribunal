// Contenu web = donnée, jamais instruction (plan v3.0, G5). Le texte venu du web est nettoyé, entouré de
// <donnees_web> et les motifs d'instruction suspects sont signalés.
// Mode API (web search natif) : la page est lue par Claude sans passer ici ; la défense est alors structurelle.
// Mode Tavily et lecture de page par le code : tout passe par nettoyerContenuWeb.
// Étape 4 : version minimale utilisée par l'adaptateur Tavily ; les tests piégés complets (injection-page) viennent à l'étape 7.

export interface ContenuNettoye {
  texte: string;
  alertes: string[];
}

const MOTIFS: { motif: RegExp; nom: string }[] = [
  { motif: /ignore\s+(?:all\s+|any\s+)?(?:your\s+|the\s+|previous\s+|prior\s+|above\s+)*(?:instructions?|rules?|prompts?)/i, nom: "ignore previous instructions" },
  { motif: /ignore[rz]?\s+(?:tes|vos|les|toutes?\s+(?:les\s+)?)?\s*(?:instructions?|règles|consignes)/i, nom: "ignore tes instructions" },
  { motif: /system\s+prompt|prompt\s+syst[èe]me/i, nom: "system prompt" },
  { motif: /(?:donne|mets?|attribue)\s+(?:une\s+)?(?:note|score)/i, nom: "donne une note" },
  { motif: /\b\d{1,2}\s*\/\s*10\b.*\b(?:vote|note|mets|donne)\b|\b(?:vote|note|mets|donne)\b.*\b\d{1,2}\s*\/\s*10\b/i, nom: "note imposée" },
  { motif: /(?:jur[ée]s?|jury)\s*,?\s*vot(?:ez|e)\s+(?:go|pivot|no-go)/i, nom: "ordre de vote" },
  { motif: /(?:you\s+must|tu\s+dois|vous\s+devez)\s+(?:vote|noter|voter|give|donner)/i, nom: "ordre de vote" },
];

const ENTITES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Retire scripts, styles, commentaires et balises ; décode les entités courantes ; replie les espaces. */
export function enleverHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (e) => ENTITES[e] ?? e)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Signale les motifs d'instruction cachée (« ignore previous », « system prompt », « donne une note »…). */
export function detecterInstructions(texte: string): string[] {
  const alertes: string[] = [];
  for (const { motif, nom } of MOTIFS) {
    const m = texte.match(motif);
    if (m && !alertes.some((a) => a.includes(nom))) alertes.push(`motif suspect « ${nom} » : « ${m[0].slice(0, 80).trim()} »`);
  }
  return alertes;
}

export function nettoyerContenuWeb(html: string, maxChars = 20_000): ContenuNettoye {
  const texte = enleverHtml(html).slice(0, maxChars);
  return { texte, alertes: detecterInstructions(texte) };
}

/** Entoure le texte web : le modèle le lit comme une donnée, pas comme une consigne. */
export function entourerDonneesWeb(texte: string, source?: string): string {
  const neutre = texte.replace(/<\/?donnees_web>/gi, "");
  return `<donnees_web${source ? ` source="${source.replace(/"/g, "")}"` : ""}>\n${neutre}\n</donnees_web>`;
}
