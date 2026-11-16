import { registerAgent } from './db.js';

export function seedAgents() {
  registerAgent('fixture-agent-1', 'Fixture Coding Agent 1');
}
