#!/usr/bin/env node
// pokelog-bdsp の旅パ（party）を MCP 経由で読み書きするサーバ。
// Web 側と同じ Cloudflare Worker 同期 API を叩く。localStorage には触らない。
//
// 環境変数:
//   POKELOG_SYNC_URL  - Worker のベース URL（例: https://pokelog-sync.example.workers.dev）
//   POKELOG_SYNC_CODE - 合言葉（Web 側で生成・表示しているもの。20文字以上推奨）

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  pullFrom,
  pushTo,
  isValidSyncCode,
  SNAPSHOT_SCHEMA,
  type Snapshot,
} from "../../src/lib/sync-core.ts";
import {
  emptyMoves,
  GAME_VERSIONS,
  NATURES,
  PARTY_MAX_MEMBERS,
  PARTY_MAX_MOVES,
  type GameVersion,
  type Party,
  type PartyMember,
} from "../../src/types/party.ts";
import {
  NATIONAL_DEX,
  lookupSpeciesId,
} from "../../src/lib/pokedex.ts";

const SYNC_URL = process.env.POKELOG_SYNC_URL ?? "";
const SYNC_CODE = process.env.POKELOG_SYNC_CODE ?? "";

if (!SYNC_URL) die("POKELOG_SYNC_URL is required");
if (!SYNC_CODE || !isValidSyncCode(SYNC_CODE)) {
  die("POKELOG_SYNC_CODE is required and must be 12–256 chars");
}

const ID_TO_NAME = new Map<number, string>(
  NATIONAL_DEX.map((e) => [e.id, e.name]),
);

function die(msg: string): never {
  // stdio MCP は stdout が JSON-RPC 専用なので、エラーは stderr に。
  process.stderr.write(`[pokelog-mcp] ${msg}\n`);
  process.exit(1);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyParty(): Party {
  return { name: "", version: "bd", members: [] };
}

function normalizeMoves(moves: readonly string[] | undefined): string[] {
  const out = emptyMoves();
  if (!moves) return out;
  for (let i = 0; i < Math.min(moves.length, PARTY_MAX_MOVES); i++) {
    out[i] = String(moves[i] ?? "");
  }
  return out;
}

/**
 * pull → mutate → push のサイクルを 409 競合時に一度だけリトライ。
 * `mutate` は party を直接書き換えず、新しい party を返す純粋関数。
 */
async function withParty(
  mutate: (party: Party) => Party,
): Promise<{ party: Party; updatedAt: string }> {
  let attempt = 0;
  while (attempt < 2) {
    const remote = await pullFrom(SYNC_URL, SYNC_CODE);
    const base: Snapshot = remote ?? {
      schema: SNAPSHOT_SCHEMA,
      updatedAt: nowIso(),
      party: emptyParty(),
      log: [],
    };
    const nextParty = mutate(base.party ?? emptyParty());
    const nextSnap: Snapshot = {
      schema: SNAPSHOT_SCHEMA,
      updatedAt: nowIso(),
      party: nextParty,
      log: base.log ?? [],
    };
    const res = await pushTo(
      SYNC_URL,
      SYNC_CODE,
      nextSnap,
      remote?.updatedAt ?? null,
    );
    if (res.ok) return { party: nextParty, updatedAt: nextSnap.updatedAt };
    if (!res.conflict) {
      throw new Error("push failed without conflict (unexpected)");
    }
    attempt++;
  }
  throw new Error("push conflict persisted after retry");
}

function ok<T>(data: T): { content: [{ type: "text"; text: string }] } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function findMember(party: Party, id: string): PartyMember {
  const m = party.members.find((x) => x.id === id);
  if (!m) throw new Error(`member not found: ${id}`);
  return m;
}

function resolveSpecies(
  speciesName: string,
): { id: number; name: string } {
  const name = speciesName.trim();
  const id = lookupSpeciesId(name);
  if (id === undefined) {
    throw new Error(
      `unknown species: "${name}" (must be a Japanese pokemon name in National Dex #1–493)`,
    );
  }
  return { id, name };
}

// --- Tools ---

const server = new McpServer({ name: "pokelog-bdsp", version: "0.1.0" });

server.registerTool(
  "get_party",
  {
    title: "旅パを取得",
    description:
      "現在の旅パ全体（name, version, members[]）をサーバから取得して返す。",
    inputSchema: {},
  },
  async () => {
    const snap = await pullFrom(SYNC_URL, SYNC_CODE);
    const party = snap?.party ?? emptyParty();
    return ok({ party, updatedAt: snap?.updatedAt ?? null });
  },
);

server.registerTool(
  "set_party_meta",
  {
    title: "旅パのメタ情報を更新",
    description:
      "旅パの name または version (bd/sp) を変更。指定したフィールドのみ更新する。",
    inputSchema: {
      name: z.string().optional(),
      version: z.enum(GAME_VERSIONS).optional(),
    },
  },
  async ({ name, version }) => {
    if (name === undefined && version === undefined) {
      throw new Error("at least one of `name` or `version` is required");
    }
    const { party } = await withParty((p) => ({
      ...p,
      name: name ?? p.name,
      version: (version ?? p.version) as GameVersion,
    }));
    return ok({ party });
  },
);

server.registerTool(
  "add_member",
  {
    title: "メンバーを追加",
    description:
      "旅パにポケモンを 1 体追加して新しいメンバー id を返す。speciesName は和名（例: ゲンガー）。最大 6 体まで。",
    inputSchema: {
      speciesName: z.string().min(1),
      nickname: z.string().optional(),
      level: z.number().int().min(1).max(100).optional(),
      nature: z.enum(NATURES).optional(),
      ability: z.string().optional(),
      heldItem: z.string().optional(),
      moves: z.array(z.string()).max(PARTY_MAX_MOVES).optional(),
      notes: z.string().optional(),
    },
  },
  async (args) => {
    const sp = resolveSpecies(args.speciesName);
    const newMember: PartyMember = {
      id: crypto.randomUUID(),
      speciesId: sp.id,
      speciesName: sp.name,
      nickname: args.nickname ?? "",
      level: args.level ?? 1,
      nature: args.nature ?? "",
      ability: args.ability ?? "",
      heldItem: args.heldItem ?? "",
      moves: normalizeMoves(args.moves),
      notes: args.notes ?? "",
    };
    const { party } = await withParty((p) => {
      if (p.members.length >= PARTY_MAX_MEMBERS) {
        throw new Error(`party is already full (max ${PARTY_MAX_MEMBERS})`);
      }
      return { ...p, members: [...p.members, newMember] };
    });
    return ok({ added: newMember, party });
  },
);

server.registerTool(
  "update_member",
  {
    title: "メンバーを更新",
    description:
      "id 指定で旅パメンバーを部分更新する。指定したフィールドだけ上書き。speciesName を指定すると speciesId も自動解決。",
    inputSchema: {
      id: z.string().min(1),
      speciesName: z.string().optional(),
      nickname: z.string().optional(),
      level: z.number().int().min(1).max(100).optional(),
      nature: z.enum(NATURES).optional(),
      ability: z.string().optional(),
      heldItem: z.string().optional(),
      moves: z.array(z.string()).max(PARTY_MAX_MOVES).optional(),
      notes: z.string().optional(),
    },
  },
  async (args) => {
    const sp = args.speciesName ? resolveSpecies(args.speciesName) : null;
    const { party } = await withParty((p) => {
      const current = findMember(p, args.id);
      const updated: PartyMember = {
        ...current,
        ...(sp
          ? { speciesId: sp.id, speciesName: sp.name }
          : {}),
        ...(args.nickname !== undefined ? { nickname: args.nickname } : {}),
        ...(args.level !== undefined ? { level: args.level } : {}),
        ...(args.nature !== undefined ? { nature: args.nature } : {}),
        ...(args.ability !== undefined ? { ability: args.ability } : {}),
        ...(args.heldItem !== undefined ? { heldItem: args.heldItem } : {}),
        ...(args.moves !== undefined
          ? { moves: normalizeMoves(args.moves) }
          : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
      };
      return {
        ...p,
        members: p.members.map((m) => (m.id === args.id ? updated : m)),
      };
    });
    return ok({ updated: party.members.find((m) => m.id === args.id), party });
  },
);

server.registerTool(
  "remove_member",
  {
    title: "メンバーを削除",
    description: "id 指定で旅パメンバーを 1 体削除する。",
    inputSchema: { id: z.string().min(1) },
  },
  async ({ id }) => {
    const { party } = await withParty((p) => {
      findMember(p, id); // 存在チェック
      return { ...p, members: p.members.filter((m) => m.id !== id) };
    });
    return ok({ removed: id, party });
  },
);

// 補助: 種族名↔ID の解決を Claude 側で前段チェックできるように。
server.registerTool(
  "lookup_species",
  {
    title: "ポケモン種族の検索",
    description:
      "和名→ID または ID→和名を引く。Gen 1–4 (#1〜#493) のみ。",
    inputSchema: {
      name: z.string().optional(),
      id: z.number().int().min(1).max(493).optional(),
    },
  },
  async ({ name, id }) => {
    if (name === undefined && id === undefined) {
      throw new Error("either `name` or `id` is required");
    }
    if (name !== undefined) {
      const got = lookupSpeciesId(name);
      return ok(
        got === undefined
          ? { found: false, query: name }
          : { found: true, id: got, name: ID_TO_NAME.get(got) ?? name },
      );
    }
    const n = ID_TO_NAME.get(id!);
    return ok(
      n === undefined
        ? { found: false, query: id }
        : { found: true, id, name: n },
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
