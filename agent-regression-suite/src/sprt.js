function createSPRT({
  alpha = 0.05,
  beta = 0.10,
  p0 = 0.95,
  p1 = 0.80,
} = {}) {
  const A = Math.log((1 - beta) / alpha);
  const B = Math.log(beta / (1 - alpha));
  const logLR0 = Math.log(p0 / p1);
  const logLR1 = Math.log((1 - p0) / (1 - p1));

  return {
    alpha,
    beta,
    p0,
    p1,
    A,
    B,
    logLR0,
    logLR1,
  };
}

function updateSPRT(state, pass) {
  state.logLikelihood += pass ? state.logLR0 : state.logLR1;
  state.n += 1;
  return state;
}

function checkVerdict(state) {
  if (state.logLikelihood >= state.A) return 'PASS';
  if (state.logLikelihood <= state.B) return 'FAIL';
  return 'INCONCLUSIVE';
}

function runSPRT(trials, params = {}) {
  const state = createSPRT(params);
  state.logLikelihood = 0;
  state.n = 0;
  const history = [];

  for (let i = 0; i < trials.length; i++) {
    updateSPRT(state, trials[i]);
    const verdict = checkVerdict(state);
    history.push({ run: i + 1, pass: trials[i], logLikelihood: state.logLikelihood, verdict });
    if (verdict !== 'INCONCLUSIVE') break;
  }

  const finalVerdict = history.length ? history[history.length - 1].verdict : 'INCONCLUSIVE';
  const confidence = computeConfidence(finalVerdict, state);

  return {
    verdict: finalVerdict,
    confidence,
    runsCompleted: state.n,
    runsRequested: trials.length,
    history,
    params: { alpha: state.alpha, beta: state.beta, p0: state.p0, p1: state.p1 },
  };
}

function computeConfidence(verdict, state) {
  if (verdict === 'PASS') return 1 - state.alpha;
  if (verdict === 'FAIL') return 1 - state.beta;
  return Math.max(state.alpha, state.beta);
}

module.exports = { createSPRT, updateSPRT, checkVerdict, runSPRT, computeConfidence };
