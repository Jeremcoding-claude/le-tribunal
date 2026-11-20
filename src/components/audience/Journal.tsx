"use client";

// Le journal d'audience : TOUT ce que la salle montre, en texte (lecteur d'écran, clavier et mobile marchent sans la 3D).
// Un chiffre affiché vient d'un événement émis par le code (affirmation sourcée, calcul de tally.ts ou de ledger.ts).
// Le vote 1 reste « sous scellés » tant que l'événement vote1_ouvert n'est pas arrivé (G14, §12.4).

import { useState } from "react";
import type { Question } from "../../lib/schemas";
import { LIBELLE_PHASE, type EtatActeur, type EtatSalle, type StatutActeur } from "../salle/etat";
import { nomAffiche, PERSONNAGES, type Personnage } from "../salle/personnages";

const fr = (n: number | null, d = 1) => (n === null ? "?" : n.toLocaleString("fr-FR", { maximumFractionDigits: d }));
const STATUT: Record<StatutActeur, string> = { attente: "attend son tour", recherche: "cherche des chiffres", verification: "met en forme", vote_scelle: "a voté sous scellés", parle: "a la parole", termine: "a terminé", absent: "absent" };
const JURES = PERSONNAGES.filter((p) => p.acteur !== "juge");
const nom = (p: Personnage, e: EtatSalle) => nomAffiche(p, e.prenomCliente);
const prenomDe = (acteur: string, e: EtatSalle): string => {
  const p = PERSONNAGES.find((x) => x.acteur === acteur);
  return p ? nom(p, e) : acteur;
};

function Section({ titre, children, id }: { titre: string; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-amber-900/30 bg-black/20 p-4">
      <h2 id={id} className="mb-2 text-sm font-semibold tracking-wide text-amber-300 uppercase">
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Pastilles({ ids, e }: { ids: string[]; e: EtatSalle }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((i) => {
        const s = e.sources[i];
        return s ? (
          <a key={i} href={s.url} target="_blank" rel="noreferrer noopener" className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 underline decoration-dotted" title={s.url}>
            {i} · {s.domaine}
          </a>
        ) : (
          <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-stone-300">
            {i}
          </span>
        );
      })}
    </span>
  );
}

function Vote({ a }: { a: EtatActeur }) {
  const v1 = a.vote1 === "aucune" ? "pas encore voté" : a.vote1 === "scellee" ? "vote 1 sous scellés" : `vote 1 : ${fr(a.note1)}/10 (${a.verdict1})`;
  const v2 = a.vote2 === "aucune" ? "" : a.vote2 === "scellee" ? " · revote sous scellés" : ` · revote : ${fr(a.note2)}/10 (${a.verdict2})`;
  return (
    <span data-vote={a.vote1}>
      {v1}
      {v2}
    </span>
  );
}

function CarteQuestions({ questions, onRepondre }: { questions: Question[]; onRepondre?: (r: { code: string; reponse: string | null }[]) => void }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  return (
    <Section titre="Questions de mise en état" id="questions">
      <form
        className="space-y-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          onRepondre?.(questions.map((q) => ({ code: q.code, reponse: valeurs[q.code]?.trim() ? valeurs[q.code] : null })));
        }}
      >
        {questions.map((q) => (
          <fieldset key={q.code} className="space-y-1">
            <legend className="text-stone-100">{q.texte}</legend>
            {q.choix.length > 0 ? (
              q.choix.map((c) => (
                <label key={c} className="flex items-center gap-2 text-stone-200">
                  <input type="radio" name={q.code} value={c} checked={valeurs[q.code] === c} onChange={() => setValeurs((v) => ({ ...v, [q.code]: c }))} />
                  {c}
                </label>
              ))
            ) : (
              <input className="w-full rounded-md border border-amber-900/50 bg-black/30 px-3 py-2 text-stone-100" aria-label={q.texte} value={valeurs[q.code] ?? ""} onChange={(ev) => setValeurs((v) => ({ ...v, [q.code]: ev.target.value }))} />
            )}
          </fieldset>
        ))}
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-semibold text-black">
            Répondre
          </button>
          <button type="button" className="rounded-md border border-amber-700 px-4 py-2 text-amber-200" onClick={() => onRepondre?.(questions.map((q) => ({ code: q.code, reponse: null })))}>
            Passer
          </button>
        </div>
      </form>
    </Section>
  );
}

export interface PropsJournal {
  etat: EtatSalle;
  /** Identifiant du procès : active le téléchargement du rapport. */
  trialId?: string;
  onRepondre?: (r: { code: string; reponse: string | null }[]) => void;
}

export default function Journal({ etat: e, trialId, onRepondre }: PropsJournal) {
  const v = e.verdict;
  const apresP1 = e.phase && !["P0", "P1a", "P1b", "P1c"].includes(e.phase);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-stone-200" data-testid="journal" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-4 py-2" role="status">
        <span className="font-semibold text-amber-200">{e.phase ? LIBELLE_PHASE[e.phase] : "En attente de l'ouverture de l'audience"}</span>
        <span className="text-xs text-stone-400">Coût estimé : {fr(e.coutUsd, 2)} $</span>
      </div>

      {e.phase && !apresP1 ? <p>Le greffier prépare le dossier.</p> : null}
      {e.identification ? (
        <Section titre="Identification du business" id="identification">
          <p>
            Statut : <strong>{e.identification.statut.replace(/_/g, " ")}</strong>. Activité : {e.identification.activite}. Commune : {e.identification.commune}.
          </p>
          {e.identification.ecarts.map((x) => (
            <p key={x} className="text-stone-400">
              Écart : {x}
            </p>
          ))}
        </Section>
      ) : null}
      {e.prenomCliente ? <p>La Cliente de ce procès s&apos;appelle {e.prenomCliente} (personnage fictif).</p> : null}
      {e.questions ? <CarteQuestions questions={e.questions} onRepondre={onRepondre} /> : null}

      {apresP1 ? (
        <Section titre="Les jurés" id="jures">
          <ul className="space-y-2">
            {JURES.map((p) => {
              const a = e.acteurs[p.acteur];
              return (
                <li key={p.acteur} className="rounded-lg bg-white/5 px-3 py-2">
                  <span className="font-semibold text-amber-100">{nom(p, e)}</span> <span className="text-stone-400">({p.role})</span> : {STATUT[a.statut]}.
                  <div className="text-xs text-stone-400">
                    {a.recherches} recherche(s), {a.sourcesVerifiees} source(s) vérifiée(s), {a.sourcesRejetees} rejetée(s) · <Vote a={a} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {e.debat.length > 0 ? (
        <Section titre="Le débat" id="debat">
          <ul className="space-y-3">
            {e.debat.map((t, i) => (
              <li key={i}>
                <div className="text-xs text-stone-400">
                  {t.tour === 1 ? "Premier tour" : "Second tour"} · {prenomDe(t.agent, e)}
                </div>
                {t.repliques.map((r, j) => (
                  <p key={j} className="rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-amber-200">{r.type === "conteste" ? "conteste" : r.type === "concede" ? "concède" : "précise"} {r.vise} :</span> « {r.texte} »
                    <Pastilles ids={r.appuis} e={e} />
                  </p>
                ))}
                {t.proposition ? (
                  <p className="mt-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <strong>Proposition d&apos;amélioration</strong> ({t.proposition.champ}) : {t.proposition.texte}
                    <Pastilles ids={t.proposition.appuis} e={e} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {e.vote1 ? (
        <Section titre="Les enveloppes du vote 1 sont ouvertes" id="vote1">
          <p>
            Moyenne {fr(e.vote1.moyenne)}/10, écart-type {fr(e.vote1.ecartType, 2)}.
          </p>
        </Section>
      ) : null}

      {e.ruling ? (
        <Section titre="Nadia corrige le plan" id="correction">
          {e.ruling.contradictions.map((c) => (
            <p key={c.id}>
              <strong>{c.id}</strong> · {c.sujet}. {c.attendu}
              <Pastilles ids={c.appuis} e={e} />
            </p>
          ))}
          <table className="mt-3 w-full text-left text-xs">
            <caption className="sr-only">Plan avant et après correction</caption>
            <thead className="text-stone-400">
              <tr>
                <th>Champ</th>
                <th>Avant</th>
                <th>Après</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {e.ruling.plan_corrige.changements.map((c) => (
                <tr key={c.champ} className="border-t border-white/10 align-top">
                  <td className="py-1 font-semibold">{c.champ}</td>
                  <td className="py-1">{c.avant}</td>
                  <td className="bg-amber-500/15 py-1 font-semibold">{c.apres}</td>
                  <td className="py-1">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-3 font-semibold text-amber-200">Conditions pour lancer</h3>
          <ul className="list-disc pl-5">
            {e.ruling.conditions_pour_lancer.map((c, i) => (
              <li key={i}>
                {c.condition}
                <Pastilles ids={c.appuis} e={e} />
              </li>
            ))}
          </ul>
          <p className="mt-2 italic">{e.ruling.par_ces_motifs}</p>
        </Section>
      ) : null}

      {e.vote2 ? (
        <Section titre="Revote" id="revote">
          <p>
            Moyenne {fr(e.vote2.moyenne)}/10, écart-type {fr(e.vote2.ecartType, 2)}.
          </p>
        </Section>
      ) : null}

      {e.alertes.length > 0 ? (
        <Section titre="Alertes" id="alertes">
          <ul className="list-disc pl-5 text-amber-200">
            {e.alertes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {e.erreurFinale ? (
        <div role="alert" className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-red-200">
          Le procès s&apos;est arrêté : {e.erreurFinale}
        </div>
      ) : null}

      {v ? (
        <section aria-labelledby="verdict" className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-6" data-testid="verdict">
          <h2 id="verdict" className="sr-only">
            Verdict
          </h2>
          <p className="text-3xl font-extrabold text-amber-100">{v.phrase}</p>
          {v.note_apres !== null && v.note_avant !== null ? (
            <p className="mt-2 text-xl font-bold">
              Note finale : {fr(v.note_avant)} → {fr(v.note_apres)} / 10 <span className="text-sm font-normal text-stone-400">(avant → après correction du plan)</span>
            </p>
          ) : null}
          <p className="mt-1">
            Verdict du jury : <strong>{v.verdict}</strong> ({v.repartition.GO} GO, {v.repartition.PIVOT} PIVOT, {v.repartition["NO-GO"]} NO-GO).
          </p>
          {v.divergence ? <p className="mt-1 text-amber-200">La moyenne des notes diverge du verdict de la majorité.</p> : null}
          {v.jury_divise ? <p className="text-amber-200">Jury divisé.</p> : null}
          {v.consensus_suspect ? <p className="text-amber-200">Consensus suspect : à examiner.</p> : null}
          <p className="mt-3 italic">{v.texte_nadia}</p>
          <p className="mt-3 text-xs text-stone-400">Ce rapport est produit par des modèles d&apos;IA à partir de sources publiques : ni conseil financier, ni conseil juridique.</p>
          {trialId ? (
            <a href={`/api/trials/${trialId}/report`} className="mt-4 inline-block rounded-md bg-amber-500 px-5 py-2 font-semibold text-black">
              Télécharger le rapport (PDF)
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
