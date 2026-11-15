/**
 * Templates Output Generator
 * Produces plain-text notice templates for stdout
 * Zero dependencies — Node.js stdlib only
 */

const {
  generateDisclosureNotice,
  generateAttributionNotice,
  generateCC0Notice,
  generateOSSNotice,
} = require('./json');

/**
 * Generate all templates as plain text for CLI output
 * @param {Object} summary - Scan summary
 * @returns {string} Combined templates with separators
 */
function generateTemplatesOutput(summary) {
  const hasFindings = summary.totalFindings > 0;
  const high = summary.byConfidence.high || 0;
  const medium = summary.byConfidence.medium || 0;
  const tools = Object.keys(summary.byTool || {}).join(', ') || 'unknown AI tools';

  const low = summary.byConfidence.low || 0;
  const sections = [
    ['DISCLOSURE NOTICE', generateDisclosureNotice(hasFindings, high, medium, tools, low)],
    ['ATTRIBUTION NOTICE', generateAttributionNotice(hasFindings, tools)],
    ['CC0 DEDICATION', generateCC0Notice(hasFindings)],
    ['OSS NOTICE', generateOSSNotice(hasFindings)],
  ];

  return sections.map(([title, content]) => 
    `═══ ${title} ═══\n\n${content}\n`
  ).join('\n');
}

/**
 * Generate a single template by name
 * @param {string} name - Template name: 'disclosure', 'attribution', 'cc0', 'oss'
 * @param {Object} summary
 * @returns {string}
 */
function generateSingleTemplate(name, summary) {
  const hasFindings = summary.totalFindings > 0;
  const high = summary.byConfidence.high || 0;
  const medium = summary.byConfidence.medium || 0;
  const tools = Object.keys(summary.byTool || {}).join(', ') || 'unknown AI tools';

  const low = summary.byConfidence.low || 0;
  switch (name.toLowerCase()) {
    case 'disclosure':
      return generateDisclosureNotice(hasFindings, high, medium, tools, low);
    case 'attribution':
      return generateAttributionNotice(hasFindings, tools);
    case 'cc0':
      return generateCC0Notice(hasFindings);
    case 'oss':
      return generateOSSNotice(hasFindings);
    default:
      throw new Error(`Unknown template: ${name}. Use: disclosure, attribution, cc0, oss`);
  }
}

module.exports = {
  generateTemplatesOutput,
  generateSingleTemplate,
};