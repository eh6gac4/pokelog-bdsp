// Build-time generator: downloads BDSP move data from PokeAPI and emits a
// static TypeScript module to stdout.
//
// Usage: node --experimental-strip-types scripts/generate-moves.ts > src/lib/moves.ts
//
// - Progress / warnings go to stderr ONLY.
// - The generated TypeScript module is written to stdout ONLY.

const VERSION_GROUP = "brilliant-diamond-shining-pearl";
const API_BASE = "https://pokeapi.co/api/v2";
const FIRST_ID = 1;
const LAST_ID = 493;
const REQUEST_DELAY_MS = 80;
const MAX_ATTEMPTS = 3;

function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with retry: up to MAX_ATTEMPTS attempts, exponential backoff on
 * network error / non-2xx / HTTP 429, honoring Retry-After when present.
 */
async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || !res.ok) {
        const retryAfter = res.headers.get("retry-after");
        let waitMs = 2 ** attempt * 500; // exponential backoff
        if (retryAfter) {
          const parsed = Number(retryAfter);
          if (Number.isFinite(parsed)) {
            waitMs = Math.max(waitMs, parsed * 1000);
          } else {
            const date = Date.parse(retryAfter);
            if (Number.isFinite(date)) {
              waitMs = Math.max(waitMs, date - Date.now());
            }
          }
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 2 ** attempt * 500;
        log(
          `  ! attempt ${attempt}/${MAX_ATTEMPTS} failed for ${url}: ${
            (err as Error).message
          } — retrying in ${backoff}ms`,
        );
        await sleep(backoff);
      }
    }
  }
  throw new Error(
    `Failed to fetch ${url} after ${MAX_ATTEMPTS} attempts: ${
      (lastErr as Error)?.message ?? String(lastErr)
    }`,
  );
}

interface PokemonResponse {
  moves: Array<{
    move: { name: string };
    version_group_details: Array<{
      version_group: { name: string };
      move_learn_method: { name: string };
      level_learned_at: number;
    }>;
  }>;
}

type LearnMethodKey = "levelUp" | "machine" | "egg" | "tutor" | "other";

interface SlugBuckets {
  // slug -> 最小習得レベル（0 = 進化/思い出し）
  levelUp: Map<string, number>;
  machine: Set<string>;
  egg: Set<string>;
  tutor: Set<string>;
  other: Set<string>;
}

function emptyBuckets(): SlugBuckets {
  return {
    levelUp: new Map(),
    machine: new Set(),
    egg: new Set(),
    tutor: new Set(),
    other: new Set(),
  };
}

function methodKey(apiName: string): LearnMethodKey {
  switch (apiName) {
    case "level-up":
      return "levelUp";
    case "machine":
      return "machine";
    case "egg":
      return "egg";
    case "tutor":
      return "tutor";
    default:
      return "other";
  }
}

interface MoveResponse {
  names: Array<{
    name: string;
    language: { name: string };
  }>;
  type: { name: string };
  damage_class: { name: string };
  power: number | null;
  pp: number;
}

interface MoveInfo {
  name: string;
  type: string;
  category: "physical" | "special" | "status";
  power: number | null;
  pp: number;
}

async function main(): Promise<void> {
  // Step 1-3: per-species BDSP learnsets, classified by learn method.
  const speciesBuckets = new Map<number, SlugBuckets>();
  const allSlugs = new Set<string>();
  let firstFiftyWithMoves = 0;
  let totalLevelUpEntries = 0;

  for (let id = FIRST_ID; id <= LAST_ID; id++) {
    const data = await fetchJson<PokemonResponse>(`${API_BASE}/pokemon/${id}`);
    const buckets = emptyBuckets();
    let count = 0;
    for (const m of data.moves) {
      const slug = m.move.name;
      let inBdsp = false;
      for (const d of m.version_group_details) {
        if (d.version_group.name !== VERSION_GROUP) continue;
        inBdsp = true;
        const key = methodKey(d.move_learn_method.name);
        if (key === "levelUp") {
          const lvl = d.level_learned_at;
          const prev = buckets.levelUp.get(slug);
          buckets.levelUp.set(slug, prev === undefined ? lvl : Math.min(prev, lvl));
        } else {
          buckets[key].add(slug);
        }
      }
      if (inBdsp) {
        allSlugs.add(slug);
        count++;
      }
    }
    if (count > 0) {
      speciesBuckets.set(id, buckets);
      totalLevelUpEntries += buckets.levelUp.size;
      if (id <= FIRST_ID + 49) firstFiftyWithMoves++;
    }
    log(`[${id}/${LAST_ID}] species (${count} BDSP moves)`);

    if (id === FIRST_ID + 49 && firstFiftyWithMoves === 0) {
      throw new Error(
        `No BDSP moves found in the first 50 species. Expected version-group slug "${VERSION_GROUP}" — it may be wrong or PokeAPI changed.`,
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (allSlugs.size < 100) {
    throw new Error(
      `Global union of move slugs implausibly small (${allSlugs.size} < 100). Aborting to avoid emitting bad data.`,
    );
  }
  if (totalLevelUpEntries === 0) {
    throw new Error(
      "No level-up moves parsed across any species — move_learn_method/level_learned_at likely not read. Aborting.",
    );
  }

  // Step 7: dense internal ids, ordered by slug ascending (deterministic).
  const sortedSlugs = Array.from(allSlugs).sort();
  const slugToId = new Map<string, number>();
  sortedSlugs.forEach((slug, idx) => slugToId.set(slug, idx));

  // Step 4: per-move details.
  const moveInfoById = new Map<number, MoveInfo>();
  let fetchedMoves = 0;
  for (const slug of sortedSlugs) {
    const data = await fetchJson<MoveResponse>(`${API_BASE}/move/${slug}`);
    let jaName = data.names.find((n) => n.language.name === "ja-Hrkt")?.name;
    if (!jaName) {
      jaName = data.names.find((n) => n.language.name === "ja")?.name;
    }
    if (!jaName) {
      jaName = slug;
      log(`  WARN: no ja-Hrkt/ja name for move "${slug}", falling back to slug`);
    }
    const category = data.damage_class.name as MoveInfo["category"];
    moveInfoById.set(slugToId.get(slug)!, {
      name: jaName,
      type: data.type.name,
      category,
      power: data.power,
      pp: data.pp,
    });
    fetchedMoves++;
    log(`[move ${fetchedMoves}/${sortedSlugs.length}] ${slug} -> ${jaName}`);
    await sleep(REQUEST_DELAY_MS);
  }

  // Step 8: emit TypeScript module to stdout ONLY.
  const out: string[] = [];
  out.push(
    "// AUTO-GENERATED by scripts/generate-moves.ts — DO NOT EDIT BY HAND.",
  );
  out.push(
    '// Source: PokeAPI (https://pokeapi.co/) version-group "brilliant-diamond-shining-pearl".',
  );
  out.push("// Regenerate: npm run gen:moves > src/lib/moves.ts");
  out.push(
    "// (Run manually only; not part of build/CI. BDSP content is frozen → regeneration rarely needed.)",
  );
  out.push(
    "// 全国図鑑 No. をキーに、その種族が BDSP で覚える技を学習方法で分類（内部 id）。",
  );
  out.push(
    "// levelUp は [moveId, 習得Lv]（Lv 昇順→id 昇順、Lv 0 は進化/思い出し）。",
  );
  out.push(
    "// 技名は PokeAPI ja-Hrkt（無ければ ja）。データ無し種族は movesForSpecies が空配列を返す。",
  );
  out.push("");
  out.push("export interface MoveInfo {");
  out.push("  readonly name: string;");
  out.push("  readonly type: string;");
  out.push('  readonly category: "physical" | "special" | "status";');
  out.push("  readonly power: number | null;");
  out.push("  readonly pp: number;");
  out.push("}");
  out.push("");
  out.push("export const MOVES: Readonly<Record<number, MoveInfo>> = {");
  for (let i = 0; i < sortedSlugs.length; i++) {
    const info = moveInfoById.get(i)!;
    const power = info.power === null ? "null" : String(info.power);
    out.push(
      `  ${i}: { name: ${JSON.stringify(info.name)}, type: ${JSON.stringify(
        info.type,
      )}, category: ${JSON.stringify(info.category)}, power: ${power}, pp: ${
        info.pp
      } },`,
    );
  }
  out.push("};");
  out.push("");
  const idOf = (slug: string) => slugToId.get(slug)!;
  out.push("export interface SpeciesLearnset {");
  out.push("  /** [moveId, level]。level 昇順→id 昇順。level 0 は進化/思い出し。 */");
  out.push("  readonly levelUp: readonly (readonly [number, number])[];");
  out.push("  readonly machine: readonly number[];");
  out.push("  readonly egg: readonly number[];");
  out.push("  readonly tutor: readonly number[];");
  out.push("  readonly other: readonly number[];");
  out.push("}");
  out.push("");
  out.push(
    "export const SPECIES_LEARNSET: Readonly<Record<number, SpeciesLearnset>> = {",
  );
  const speciesIds = Array.from(speciesBuckets.keys()).sort((a, b) => a - b);
  const numAsc = (a: number, b: number) => a - b;
  for (const sid of speciesIds) {
    const b = speciesBuckets.get(sid)!;
    const levelUp = Array.from(b.levelUp.entries())
      .map(([slug, lvl]) => [idOf(slug), lvl] as [number, number])
      .sort((x, y) => x[1] - y[1] || x[0] - y[0]);
    const bucketIds = (s: Set<string>) =>
      Array.from(s, idOf).sort(numAsc);
    const machine = bucketIds(b.machine);
    const egg = bucketIds(b.egg);
    const tutor = bucketIds(b.tutor);
    const other = bucketIds(b.other);
    const lvStr = levelUp.map(([id, lv]) => `[${id}, ${lv}]`).join(", ");
    out.push(
      `  ${sid}: { levelUp: [${lvStr}], machine: [${machine.join(
        ", ",
      )}], egg: [${egg.join(", ")}], tutor: [${tutor.join(
        ", ",
      )}], other: [${other.join(", ")}] },`,
    );
  }
  out.push("};");
  out.push("");
  out.push("const NO_MOVES: readonly string[] = [];");
  out.push("const speciesNameCache = new Map<number, readonly string[]>();");
  out.push("");
  out.push(
    "/** 種族が BDSP で覚える技名（日本語・重複なし）。全バケツの id 和集合を解決。 */",
  );
  out.push(
    "export function movesForSpecies(speciesId: number): readonly string[] {",
  );
  out.push("  const cached = speciesNameCache.get(speciesId);");
  out.push("  if (cached) return cached;");
  out.push("  const ls = SPECIES_LEARNSET[speciesId];");
  out.push("  if (!ls) return NO_MOVES;");
  out.push("  const ids = new Set<number>([");
  out.push("    ...ls.levelUp.map(([id]) => id),");
  out.push("    ...ls.machine,");
  out.push("    ...ls.egg,");
  out.push("    ...ls.tutor,");
  out.push("    ...ls.other,");
  out.push("  ]);");
  out.push("  if (ids.size === 0) return NO_MOVES;");
  out.push("  const names = Array.from(ids, (id) => MOVES[id].name);");
  out.push("  speciesNameCache.set(speciesId, names);");
  out.push("  return names;");
  out.push("}");
  out.push("");
  out.push("export interface ClassifiedLearnset {");
  out.push(
    "  readonly levelUp: readonly { name: string; level: number }[];",
  );
  out.push("  readonly machine: readonly string[];");
  out.push("  readonly egg: readonly string[];");
  out.push("  readonly tutor: readonly string[];");
  out.push("  readonly other: readonly string[];");
  out.push("}");
  out.push(
    "const classifiedCache = new Map<number, ClassifiedLearnset | null>();",
  );
  out.push(
    "/** UI 用: 学習方法ごとに技名（とレベル）を解決。データ無し種族は null。 */",
  );
  out.push(
    "export function classifiedMovesForSpecies(speciesId: number): ClassifiedLearnset | null {",
  );
  out.push("  if (classifiedCache.has(speciesId))");
  out.push("    return classifiedCache.get(speciesId)!;");
  out.push("  const ls = SPECIES_LEARNSET[speciesId];");
  out.push("  const result: ClassifiedLearnset | null = ls");
  out.push("    ? {");
  out.push(
    "        levelUp: ls.levelUp.map(([id, level]) => ({ name: MOVES[id].name, level })),",
  );
  out.push("        machine: ls.machine.map((id) => MOVES[id].name),");
  out.push("        egg: ls.egg.map((id) => MOVES[id].name),");
  out.push("        tutor: ls.tutor.map((id) => MOVES[id].name),");
  out.push("        other: ls.other.map((id) => MOVES[id].name),");
  out.push("      }");
  out.push("    : null;");
  out.push("  classifiedCache.set(speciesId, result);");
  out.push("  return result;");
  out.push("}");
  out.push("");
  out.push("let nameToInfo: Map<string, MoveInfo> | null = null;");
  out.push("/** 技名から詳細を引く（将来の技詳細表示用）。 */");
  out.push("export function moveInfo(name: string): MoveInfo | undefined {");
  out.push("  if (!nameToInfo) {");
  out.push("    nameToInfo = new Map();");
  out.push(
    "    for (const id of Object.keys(MOVES)) nameToInfo.set(MOVES[Number(id)].name, MOVES[Number(id)]);",
  );
  out.push("  }");
  out.push("  return nameToInfo.get(name);");
  out.push("}");
  out.push("");

  process.stdout.write(out.join("\n"));

  log(
    `\nDone: ${sortedSlugs.length} moves, ${speciesIds.length} species with BDSP moves.`,
  );
}

main().catch((err) => {
  log(`FATAL: ${(err as Error).message}`);
  process.exit(1);
});
