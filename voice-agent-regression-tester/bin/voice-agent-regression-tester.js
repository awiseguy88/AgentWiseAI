#!/usr/bin/env node
require('../src/cli').main(process.argv.slice(2)).then((code) => {
  process.exitCode = code === undefined ? 0 : code;
});