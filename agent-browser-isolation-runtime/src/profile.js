'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * ProfileStore owns one Chromium user-data-dir per profile and the persisted
 * cookie / storage state that belongs to that profile only.
 *
 * Every profile gets its own directory and its own `state.json`. Nothing is
 * shared between profiles, which is the property the isolation tests assert.
 */
class ProfileStore {
  constructor(rootDir) {
    this.rootDir = path.resolve(rootDir);
  }

  profileDir(name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`invalid profile name: ${name}`);
    }
    return path.join(this.rootDir, name);
  }

  userDataDir(name) {
    return path.join(this.profileDir(name), 'user-data-dir');
  }

  statePath(name) {
    return path.join(this.profileDir(name), 'state.json');
  }

  create(name) {
    const dir = this.profileDir(name);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(this.userDataDir(name), { recursive: true });
    const state = emptyState(name);
    this.save(name, state);
    return state;
  }

  exists(name) {
    return fs.existsSync(this.statePath(name));
  }

  load(name) {
    const file = this.statePath(name);
    if (!fs.existsSync(file)) {
      return this.create(name);
    }
    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`profile state for ${name} is corrupt: ${err.message}`);
    }
    return normalizeState(name, parsed);
  }

  save(name, state) {
    const file = this.statePath(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
    return state;
  }

  list() {
    if (!fs.existsSync(this.rootDir)) return [];
    return fs
      .readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => fs.existsSync(this.statePath(entry.name)))
      .map((entry) => entry.name)
      .sort();
  }

  remove(name) {
    fs.rmSync(this.profileDir(name), { recursive: true, force: true });
  }
}

function emptyState(name) {
  return {
    profile: name,
    version: 1,
    cookies: {},
    storage: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(name, parsed) {
  const state = emptyState(name);
  state.cookies = parsed && typeof parsed.cookies === 'object' ? parsed.cookies : {};
  state.storage = parsed && typeof parsed.storage === 'object' ? parsed.storage : {};
  state.createdAt = parsed.createdAt || state.createdAt;
  state.updatedAt = parsed.updatedAt || state.updatedAt;
  return state;
}

module.exports = { ProfileStore };
