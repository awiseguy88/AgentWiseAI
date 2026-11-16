'use strict';

const { parseTrace } = require('./parser');
const { analyzeTrace } = require('./analyzer');
const { writeReports } = require('./report');

module.exports = {
  parseTrace,
  analyzeTrace,
  writeReports,
};