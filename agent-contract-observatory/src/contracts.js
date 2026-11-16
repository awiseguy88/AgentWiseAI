'use strict';

const fs = require('fs');
const path = require('path');
const { validateSchema } = require('./validator');

/**
 * Contract store: loads versioned tool contracts from a local directory.
 *
 * Contract file shape:
 * {
 *   server: string, tool: string, version: string,
 *   description?: string, sideEffect?: string,
 *   input: JSON Schema, output: JSON Schema
 * }
 */

function loadContractFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = JSON.parse(raw);
  const errors = validateSchema(
    {
      type: 'object',
      required: ['server', 'tool', 'version', 'input', 'output'],
      properties: {
        server: { type: 'string' },
        tool: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
        sideEffect: { type: 'string' },
        input: { type: 'object' },
        output: { type: 'object' },
      },
    },
    doc
  );
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Invalid contract ${filePath}: ${detail}`);
  }
  return doc;
}

class ContractStore {
  constructor(contractsDir) {
    this.contractsDir = contractsDir;
    this.contracts = new Map(); // key: "server/tool@version" -> contract
    this.byServerTool = new Map(); // key: "server/tool" -> contract[] sorted by version
    this.loaded = false;
  }

  load() {
    if (!this.contractsDir || !fs.existsSync(this.contractsDir)) {
      this.contracts = new Map();
      this.byServerTool = new Map();
      this.loaded = true;
      return { count: 0, files: [] };
    }
    const files = fs.readdirSync(this.contractsDir).filter((f) => f.endsWith('.json')).sort();
    const contracts = new Map();
    const byServerTool = new Map();
    for (const f of files) {
      const filePath = path.join(this.contractsDir, f);
      const doc = loadContractFile(filePath);
      const key = `${doc.server}/${doc.tool}@${doc.version}`;
      if (contracts.has(key)) {
        throw new Error(`Duplicate contract key ${key} (${f})`);
      }
      contracts.set(key, doc);
      const stKey = `${doc.server}/${doc.tool}`;
      const list = byServerTool.get(stKey) || [];
      list.push(doc);
      byServerTool.set(stKey, list);
    }
    for (const [k, list] of byServerTool.entries()) {
      list.sort((a, b) => {
        const va = compareVersion(a.version);
        const vb = compareVersion(b.version);
        if (va < vb) return -1;
        if (va > vb) return 1;
        return a.version.localeCompare(b.version);
      });
    }
    this.contracts = contracts;
    this.byServerTool = byServerTool;
    this.loaded = true;
    return { count: contracts.size, files };
  }

  list() {
    return Array.from(this.contracts.values()).map((c) => ({
      server: c.server,
      tool: c.tool,
      version: c.version,
      key: `${c.server}/${c.tool}@${c.version}`,
      sideEffect: c.sideEffect,
      description: c.description,
    }));
  }

  find(server, tool, version) {
    const stKey = `${server}/${tool}`;
    const candidates = this.byServerTool.get(stKey) || [];
    if (version) {
      const exact = candidates.find((c) => c.version === version);
      return exact || null;
    }
    return candidates[candidates.length - 1] || null; // latest
  }

  findByKey(key) {
    return this.contracts.get(key) || null;
  }
}

function compareVersion(v) {
  return (v || '0.0.0').split('.').map((n) => Number(n) || 0);
}

module.exports = { ContractStore };
