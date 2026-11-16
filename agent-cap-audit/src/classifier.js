'use strict';

const CONNECTOR_RULES = [
  { match: /\bslack\b/i, connector: 'slack', risks: ['read', 'write', 'impersonate-user', 'external-post'], reason: 'Slack connectors can read channels/messages and post as the authenticated user.' },
  { match: /\bgmail\b|google[_-]?mail/i, connector: 'gmail', risks: ['read', 'write', 'impersonate-user', 'external-post'], reason: 'Gmail connectors can read and send email as the authenticated user.' },
  { match: /\bgoogle[_-]?drive\b|\bgdrive\b|\bdrive\b/i, connector: 'drive', risks: ['read', 'write', 'external-post'], reason: 'Drive connectors can read and modify shared files.' },
  { match: /\bgoogle[_-]?calendar\b|\bgcal\b|\bcalendar\b/i, connector: 'calendar', risks: ['read', 'write', 'impersonate-user'], reason: 'Calendar connectors can read and create events as the user.' },
  { match: /\bcontacts?\b/i, connector: 'contacts', risks: ['read'], reason: 'Contacts connectors can expose personal contact data.' },
  { match: /\bgithub\b/i, connector: 'github', risks: ['read', 'write', 'impersonate-user', 'external-post'], reason: 'GitHub connectors can read repos and act (issues/PRs/comments) as the authenticated user.' },
  { match: /\bnotion\b/i, connector: 'notion', risks: ['read', 'write', 'external-post'], reason: 'Notion connectors can read and modify workspace content.' },
  { match: /\bfigma\b/i, connector: 'figma', risks: ['read', 'write'], reason: 'Figma connectors can read and modify design files.' },
  { match: /\blinear\b/i, connector: 'linear', risks: ['read', 'write', 'external-post'], reason: 'Linear connectors can read and create/update issues.' },
  { match: /\bjira\b/i, connector: 'jira', risks: ['read', 'write', 'external-post'], reason: 'Jira connectors can read and modify tickets.' },
  { match: /\bdiscord\b/i, connector: 'discord', risks: ['read', 'write', 'impersonate-user', 'external-post'], reason: 'Discord connectors can read and post messages as a bot/user.' },
];

function classifyCapability(cap) {
  const hay = [cap.name, cap.server, cap.command, cap.detail].filter(Boolean).join(' ');
  for (const rule of CONNECTOR_RULES) {
    if (rule.match.test(hay)) {
      return {
        ...cap,
        connector: rule.connector,
        risks: Array.from(new Set([...(cap.risks || []), ...rule.risks])),
        reason: cap.reason || rule.reason,
      };
    }
  }
  // generic MCP/tool detection
  if (/\bmcp\b|tool|connector/i.test(hay)) {
    return {
      ...cap,
      connector: cap.connector || cap.name || 'unknown',
      risks: Array.from(new Set([...(cap.risks || []), 'read'])),
      reason: cap.reason || 'Unclassified tool/connector detected; review permissions manually.',
    };
  }
  return {
    ...cap,
    connector: cap.connector || cap.name || 'unknown',
    risks: Array.from(new Set([...(cap.risks || []), 'read'])),
    reason: cap.reason || 'Capability detected; review permissions manually.',
  };
}

function classifyAll(capabilities) {
  return capabilities.map(classifyCapability);
}

module.exports = { classifyCapability, classifyAll, CONNECTOR_RULES };
