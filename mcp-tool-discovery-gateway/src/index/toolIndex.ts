import type { GatewayConfig, IndexedTool, SearchResult, ServerConfig } from "../types.js";
import { schemaHash, byteSize, estimateTokensFromBytes } from "../utils/hash.js";

export interface IndexState {
  tools: IndexedTool[];
  totalSchemaBytes: number;
  totalSchemaTokensEstimate: number;
  serverCounts: Record<string, number>;
}

export class ToolIndex {
  private tools: IndexedTool[] = [];
  private byId = new Map<string, IndexedTool>();
  private byServer = new Map<string, IndexedTool[]>();
  private tags = new Set<string>();

  constructor(private cfg: GatewayConfig) {}

  get state(): IndexState {
    const serverCounts: Record<string, number> = {};
    for (const t of this.tools) serverCounts[t.server] = (serverCounts[t.server] ?? 0) + 1;
    return {
      tools: this.tools,
      totalSchemaBytes: this.tools.reduce((a, t) => a + t.schemaBytes, 0),
      totalSchemaTokensEstimate: this.tools.reduce((a, t) => a + estimateTokensFromBytes(t.schemaBytes), 0),
      serverCounts,
    };
  }

  get all(): IndexedTool[] {
    return this.tools;
  }

  async refresh(): Promise<void> {
    this.tools = [];
    this.byId.clear();
    this.byServer.clear();
    this.tags.clear();
    for (const server of this.cfg.servers) {
      if (server.disabled) continue;
      try {
        const tools = await this.fetchServerTools(server);
        for (const tool of tools) {
          const id = `${server.name}.${tool.name}`;
          const schema = tool as any;
          const indexed: IndexedTool = {
            id,
            server: server.name,
            name: tool.name,
            description: typeof tool.description === "string" ? tool.description : "",
            schema,
            schemaHash: schemaHash(schema),
            schemaBytes: byteSize(schema),
            tags: Array.isArray(server.tags) ? server.tags : [],
          };
          this.tools.push(indexed);
          this.byId.set(id, indexed);
          const arr = this.byServer.get(server.name) ?? [];
          arr.push(indexed);
          this.byServer.set(server.name, arr);
          for (const tag of indexed.tags) this.tags.add(tag);
        }
      } catch (e) {
        // Record failure: server unavailable during index refresh; tools omitted.
        console.error(`[mcp-tool-discovery-gateway] index: server ${server.name} failed: ${(e as Error).message}`);
      }
    }
  }

  private async fetchServerTools(server: ServerConfig): Promise<any[]> {
    const { StdioMcpClient } = await import("../clients/stdioClient.js");
    const { HttpMcpClient } = await import("../clients/httpClient.js");
    const client = server.transport === "stdio" ? new StdioMcpClient(server) : new HttpMcpClient(server);
    try {
      await client.initialize();
      return await client.listTools();
    } finally {
      await client.close().catch(() => {});
    }
  }

  search(query: string, opts?: { server?: string; tags?: string[]; limit?: number }): SearchResult[] {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const results: SearchResult[] = [];
    for (const t of this.tools) {
      if (opts?.server && t.server !== opts.server) continue;
      if (opts?.tags && opts.tags.length && !opts.tags.every((tag) => t.tags.includes(tag))) continue;
      if (terms.length === 0) {
        results.push({ ...toResult(t), score: 0 });
        continue;
      }
      const hay = `${t.id} ${t.name} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (t.name.toLowerCase() === term) score += 10;
        if (t.name.toLowerCase().includes(term)) score += 5;
        if (t.description.toLowerCase().includes(term)) score += 2;
        if (t.id.toLowerCase().includes(term)) score += 3;
        if (t.tags.some((tg) => tg.toLowerCase().includes(term))) score += 1;
      }
      if (score > 0) results.push({ ...toResult(t), score });
    }
    results.sort((a, b) => b.score - a.score);
    if (opts?.limit && opts.limit > 0) return results.slice(0, opts.limit);
    return results;
  }

  get(id: string): IndexedTool | undefined {
    return this.byId.get(id);
  }

  toolsByServer(server: string): IndexedTool[] {
    return this.byServer.get(server) ?? [];
  }
}

function toResult(t: IndexedTool): Omit<SearchResult, "score"> {
  return {
    id: t.id,
    server: t.server,
    name: t.name,
    description: t.description,
    schemaHash: t.schemaHash,
    tags: t.tags,
  };
}