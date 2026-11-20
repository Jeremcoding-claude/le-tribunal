// Cache en mémoire avec durée de vie (registre : 24 h, config.ts registry.fr.cacheHeures). L'horloge est injectable.

export class CacheTtl<T> {
  private readonly entrees = new Map<string, { valeur: T; expire: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maintenant: () => number = Date.now,
  ) {}

  get(cle: string): T | undefined {
    const e = this.entrees.get(cle);
    if (!e) return undefined;
    if (this.maintenant() >= e.expire) {
      this.entrees.delete(cle);
      return undefined;
    }
    return e.valeur;
  }

  set(cle: string, valeur: T): void {
    this.entrees.set(cle, { valeur, expire: this.maintenant() + this.ttlMs });
  }
}
