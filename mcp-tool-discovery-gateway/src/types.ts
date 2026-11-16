export type TransportKind = "stdio" | "http";

export interface StdioServerConfig {
  name: string;
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  tags?: string[];
  disabled?: boolean;
}

export interface HttpServerConfig {
  name: string;
  transport: "http";
  url: string;
  headers?: Record<string, string>;
  tags?: string[];
  disabled?: boolean;
}

export type ServerConfig = StdioServerConfig | HttpServerConfig;

export interface PolicyConfig {
  allowServers?: string[];
  denyServers?: string[];
  allowTools?: string[]; // full ids server.tool or patterns with *
  denyTools?: string[];
  maxSchemasPerRequest?: number;
  maxSchemaBytesPerRequest?: number;
}

export interface GatewayConfig {
  servers: ServerConfig[];
  policy?: PolicyConfig;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}

export interface IndexedTool {
  id: string; // server.tool
  server: string;
  name: string;
  description: string;
  schema: ToolSchema;
  schemaHash: string;
  schemaBytes: number;
  tags: string[];
}

export interface SearchResult {
  id: string;
  server: string;
  name: string;
  description: string;
  schemaHash: string;
  tags: string[];
  score: number;
}

export interface AuditEvent {
  ts: string;
  type: "search" | "schema" | "invoke" | "policy_deny" | "error" | "index";
  toolId?: string;
  server?: string;
  query?: string;
  ok: boolean;
  detail?: string;
  schemaBytes?: number;
  estimatedTokens?: number;
}

export interface AuditReport {
  startedAt: string;
  finishedAt?: string;
  events: AuditEvent[];
  totals: {
    indexedTools: number;
    indexedSchemaBytes: number;
    indexedSchemaTokensEstimate: number;
    requestedSchemaCount: number;
    requestedSchemaBytes: number;
    requestedSchemaTokensEstimate: number;
    searches: number;
    invocations: number;
    errors: number;
    policyDenials: number;
  };
}
