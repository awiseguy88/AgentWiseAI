'use strict';

/**
 * Documented stealth configuration. This is the only configuration under which
 * the detection test is expected to pass. Changing it must be reflected in the
 * README and is considered a product decision.
 */
const STEALTH_CONFIG = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 768 },
  locale: 'en-US',
  timezone: 'America/New_York',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-infobars',
    '--window-size=1366,768',
  ],
  initScript:
    'Object.defineProperty(navigator, "webdriver", { get: () => undefined });\n' +
    'window.chrome = window.chrome || { runtime: {} };',
  realInput: true,
  fingerprintSeed: 0,
};

function applyStealth(profile, config = STEALTH_CONFIG) {
  profile.stealth = config;
  profile.userAgent = config.userAgent;
  profile.viewport = config.viewport;
  profile.locale = config.locale;
  profile.timezone = config.timezone;
  profile.args = Array.isArray(config.args) ? [...config.args] : [];
  profile.initScript = config.initScript;
  profile.realInput = config.realInput;
  return profile;
}

function isStealthy(profile) {
  const c = profile.stealth || {};
  return (
    !/HeadlessChrome/i.test(profile.userAgent || '') &&
    Array.isArray(c.args) &&
    c.args.includes('--disable-blink-features=AutomationControlled') &&
    !!c.initScript &&
    c.initScript.includes('webdriver') &&
    c.realInput === true
  );
}

module.exports = { STEALTH_CONFIG, applyStealth, isStealthy };
