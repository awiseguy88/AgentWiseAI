/**
 * AI Code Disclosure Manifest - Main CLI Entry Point
 * Dependency-free offline-first tool for scanning AI-assist markers
 * Zero dependencies — Node.js stdlib only
 */

const { scanRepository, quickScan } = require('./scan');
const { generateJSON } = require('./output/json');
const { generateHTML } = require('./output/html');
const { generateTemplatesOutput } = require('./output/templates');
const { findRepoRoot } = require('./utils');

const VERSION = '1.0.0';

/**
 * Print usage/help
 */
function printHelp() {
  console.log(`
AI Code Disclosure Manifest v${VERSION}
Offline-first CLI to scan repositories for AI-assist markers and generate disclosure manifests.

Usage:
  ai-disclose scan [path] [options]     Scan repository for AI markers (default)
  ai-disclose templates [path] [options] Output notice templates only
  ai-disclose --help                    Show this help
  ai-disclose --version                 Show version

Commands:
  scan        Full scan: git history + source files (default)
  quick       Quick scan: git history only (faster)
  templates   Generate notice templates from last scan or current repo

Options:
  -f, --format <format>     Output format: json, html, templates (default: html)
  -o, --output <file>       Output file (default: stdout for json/templates, disclosure-manifest.html for html)
  -c, --confidence <level>  Minimum confidence: high, medium, low, all (default: all)
  -s, --since <date>        Only scan commits after ISO date (e.g., 2024-01-01)
  -q, --quick               Quick mode: git history only, no file scan
  -v, --verbose             Verbose progress output
  -h, --help                Show help

Examples:
  ai-disclose scan                          # Scan current repo, output HTML
  ai-disclose scan ./my-project -f json     # Scan path, output JSON to stdout
  ai-disclose scan -f html -o report.html   # Save HTML report to file
  ai-disclose scan --since 2024-01-01       # Only commits after 2024-01-01
  ai-disclose scan --confidence high        # Only high-confidence findings
  ai-disclose quick                         # Fast git-only scan
  ai-disclose templates -f json             # Output templates as JSON

Output Formats:
  json        Machine-readable manifest with findings, summary, and templates
  html        Self-contained offline HTML report with interactive templates
  templates   Plain-text disclosure, attribution, CC0, and OSS notices

Exit Codes:
  0   Success
  1   Error (not a git repo, invalid args, etc.)

Generated reports contain no external dependencies — fully offline.
Part of the AaronWiseAI tool collection — https://aaronwiseai.com/
`);
}

/**
 * Parse command line arguments
 * @param {string[]} args - process.argv.slice(2)
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    command: 'scan',
    path: process.cwd(),
    format: 'html',
    output: null,
    confidence: 'all',
    since: null,
    quick: false,
    verbose: false,
    help: false,
    version: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    // Commands (non-flag first arg)
    if (i === 0 && !arg.startsWith('-')) {
      if (['scan', 'quick', 'templates', 'help', 'version'].includes(arg)) {
        options.command = arg;
        i++;
        continue;
      }
    }

    // Flags
    switch (arg) {
      case '-f':
      case '--format':
        options.format = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-c':
      case '--confidence':
        options.confidence = args[++i];
        break;
      case '-s':
      case '--since':
        options.since = args[++i];
        break;
      case '-q':
      case '--quick':
        options.quick = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--version':
        options.version = true;
        break;
      default:
        // Positional path argument
        if (!arg.startsWith('-') && options.path === process.cwd()) {
          options.path = arg;
        } else {
          console.error(`Unknown argument: ${arg}`);
          process.exit(1);
        }
    }
    i++;
  }

  return options;
}

/**
 * Validate options
 * @param {Object} options
 */
function validateOptions(options) {
  const validFormats = ['json', 'html', 'templates'];
  const validConfidence = ['high', 'medium', 'low', 'all'];

  if (!validFormats.includes(options.format)) {
    throw new Error(`Invalid format: ${options.format}. Use: ${validFormats.join(', ')}`);
  }
  if (!validConfidence.includes(options.confidence)) {
    throw new Error(`Invalid confidence: ${options.confidence}. Use: ${validConfidence.join(', ')}`);
  }
  if (options.since) {
    const d = new Date(options.since);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${options.since}. Use ISO format (YYYY-MM-DD)`);
    }
  }
}

/**
 * Write output to file or stdout
 * @param {string} content
 * @param {string|null} outputPath
 * @param {string} defaultFilename
 * @param {string} format
 * @param {Object} opts - options object with .format
 */
function writeOutput(content, outputPath, defaultFilename, opts) {
  const fs = require('fs');
  const path = require('path');
  const format = opts && opts.format ? opts.format : 'html';
  
  if (outputPath) {
    const fullPath = path.resolve(outputPath);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.error(`Written to: ${fullPath}`);
  } else if (format === 'html') {
    const fullPath = path.resolve(defaultFilename);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.error(`Written to: ${fullPath}`);
  } else {
    console.log(content);
  }
}

/**
 * Main CLI handler
 * @param {string[]} argv - process.argv
 */
async function main(argv) {
  const args = argv.slice(2);
  
  // Handle help/version early
  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    printHelp();
    return 0;
  }
  if (args.includes('--version') || args[0] === 'version') {
    console.log(VERSION);
    return 0;
  }

  const options = parseArgs(args);
  
  try {
    validateOptions(options);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return 1;
  }

  // Find repository root
  const repoRoot = findRepoRoot(options.path);
  if (!repoRoot) {
    console.error(`Error: Not a git repository: ${options.path}`);
    console.error('Run from within a git repository or specify a path with -p/--path');
    return 1;
  }

  if (options.verbose) {
    console.error(`Repository: ${repoRoot}`);
    console.error(`Command: ${options.command}`);
    console.error(`Format: ${options.format}`);
    console.error(`Confidence: ${options.confidence}`);
    if (options.since) console.error(`Since: ${options.since}`);
  }

  let results;

  try {
    if (options.command === 'quick' || options.quick) {
      results = await quickScan(repoRoot, {
        since: options.since,
        confidence: options.confidence,
        verbose: options.verbose,
      });
    } else if (options.command === 'templates') {
      // For templates, do a quick scan to get summary
      results = await quickScan(repoRoot, {
        since: options.since,
        confidence: options.confidence,
        verbose: options.verbose,
      });
    } else {
      results = await scanRepository(repoRoot, {
        since: options.since,
        confidence: options.confidence,
        verbose: options.verbose,
      });
    }
  } catch (e) {
    console.error(`Scan error: ${e.message}`);
    return 1;
  }

  // Generate output
  let content;
  const defaultHtmlFile = 'disclosure-manifest.html';

  try {
    switch (options.format) {
      case 'json':
        content = generateJSON(results);
        writeOutput(content, options.output, defaultHtmlFile, options);
        break;
      case 'html':
        content = generateHTML(results);
        writeOutput(content, options.output, defaultHtmlFile, options);
        break;
      case 'templates':
        content = generateTemplatesOutput(results.summary);
        writeOutput(content, options.output, defaultHtmlFile, options);
        break;
    }
  } catch (e) {
    console.error(`Output error: ${e.message}`);
    return 1;
  }

  if (options.verbose) {
    console.error(`Done. Total findings: ${results.summary.totalFindings}`);
  }

  return 0;
}

// Run if executed directly
if (require.main === module) {
  main(process.argv).then(code => process.exit(code)).catch(err => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, validateOptions, printHelp, VERSION };