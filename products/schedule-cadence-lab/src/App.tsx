import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseCron, describeCron, nextRuns, localTimeZone, EXAMPLES, REFERENCE, TIPS, type Example, type ParsedCron, type CronError } from './cron';

function App() {
  const [expression, setExpression] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCron | null>(null);
  const [parseError, setParseError] = useState<CronError | null>(null);
  const [description, setDescription] = useState<string>('');
  const [runs, setRuns] = useState<{ datetime: Date; absolute: string; relative: string }[]>([]);
  const [runCount, setRunCount] = useState<number>(5);
  const [now] = useState<Date>(new Date());
  const [showReference, setShowReference] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [copiedExpr, setCopiedExpr] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // debounced parsing
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const parse = useCallback((expr: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = parseCron(expr);
      if (result.ok) {
        setParseError(null);
        setParsed(result.parsed);
        const desc = describeCron(result.parsed);
        if (desc.ok) {
          setDescription(desc.description);
        }
        const nxt = nextRuns(result.parsed, now, runCount);
        setRuns(nxt);
      } else {
        setParseError(result.error);
        setParsed(null);
        setDescription('');
        setRuns([]);
      }
    }, 150);
  }, [runCount, now]);

  // load from hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const expr = decodeURIComponent(hash);
        setExpression(expr);
        parse(expr);
      } catch {
        // ignore
      }
    } else {
      parse(expression);
    }
  }, []);

  // persist to hash
  useEffect(() => {
    if (expression) {
      window.location.hash = encodeURIComponent(expression);
    } else {
      window.location.hash = '';
    }
  }, [expression]);

  // copy to clipboard
  const copy = async (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExpression(val);
    parse(val);
  };

  const handleExampleClick = (ex: Example) => {
    setExpression(ex.expression);
    parse(ex.expression);
    inputRef.current?.focus();
  };

  const handleRunCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRunCount(Number(e.target.value));
  };

  // compute valid state
  const isValid = parsed !== null && parseError === null;

  return (
    <div className="scl-app">
      <header className="scl-header">
        <h1>Schedule Cadence Lab</h1>
        <p className="scl-tagline">Cron expression editor — plain English, next runs, field breakdown</p>
      </header>

      <main className="scl-main">
        <section className="scl-editor" aria-label="Cron editor">
          <label htmlFor="cron-input" className="scl-label">Cron expression (5 fields)</label>
          <div className="scl-input-row">
            <input
              ref={inputRef}
              id="cron-input"
              type="text"
              value={expression}
              onChange={handleChange}
              placeholder="e.g. 0 2 * * *"
              className={`scl-input ${isValid ? 'valid' : 'invalid'}`}
              aria-invalid={!isValid && expression.length > 0}
              aria-describedby={!isValid && expression.length > 0 ? 'cron-error' : undefined}
              spellCheck={false}
            />
            <div className="scl-actions">
              <button
                type="button"
                className="scl-btn-copy"
                onClick={() => copy(expression, setCopiedExpr)}
                aria-label={copiedExpr ? 'Copied!' : 'Copy expression'}
              >
                {copiedExpr ? '✓' : '📋'}
              </button>
              <button
                type="button"
                className="scl-btn-copy"
                onClick={() => copy(description, setCopiedDesc)}
                disabled={!isValid}
                aria-label={copiedDesc ? 'Copied!' : 'Copy description'}
              >
                {copiedDesc ? '✓' : '📋'}
              </button>
            </div>
          </div>
          {!isValid && expression.length > 0 && parseError && (
            <p id="cron-error" className="scl-error" role="alert">
              <strong>{parseError.fieldLabel}:</strong> {parseError.message}
            </p>
          )}
          {expression.length === 0 && (
            <p className="scl-hint">Enter a 5-field cron expression (minute hour day-of-month month day-of-week).</p>
          )}
        </section>

        {isValid && parsed && (
          <section className="scl-description" aria-label="Description">
            <h2>Description</h2>
            <p className="scl-desc-text">{description}</p>
            <details className="scl-breakdown">
              <summary>Field breakdown</summary>
              <table className="scl-breakdown-table">
                <thead>
                  <tr><th>Field</th><th>Values</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Minute</td>
                    <td>{parsed.minute.join(', ') || '—'}</td>
                    <td>{parsed.minute.length === 60 ? 'Every minute' : `At minutes ${parsed.minute.join(', ')}`}</td>
                  </tr>
                  <tr>
                    <td>Hour</td>
                    <td>{parsed.hour.join(', ') || '—'}</td>
                    <td>{parsed.hour.length === 24 ? 'Every hour' : `At hours ${parsed.hour.map(h => h.toString().padStart(2, '0')).join(', ')}`}</td>
                  </tr>
                  <tr>
                    <td>Day of month</td>
                    <td>{parsed.dayOfMonth.join(', ') || '—'}</td>
                    <td>{parsed.dayOfMonth.length === 31 ? 'Every day' : `Days ${parsed.dayOfMonth.join(', ')}`}</td>
                  </tr>
                  <tr>
                    <td>Month</td>
                    <td>{parsed.month.join(', ') || '—'}</td>
                    <td>{parsed.month.length === 12 ? 'Every month' : parsed.month.map(m => ['','January','February','March','April','May','June','July','August','September','October','November','December'][m]).join(', ')}</td>
                  </tr>
                  <tr>
                    <td>Day of week</td>
                    <td>{parsed.dayOfWeek.join(', ') || '—'}</td>
                    <td>{parsed.dayOfWeek.length === 7 ? 'Every day' : parsed.dayOfWeek.map(d => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]).join(', ')}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          </section>
        )}

        {isValid && (
          <section className="scl-runs" aria-label="Next runs">
            <div className="scl-runs-header">
              <h2>Next {runCount} run{runCount > 1 ? 's' : ''}</h2>
              <label className="scl-run-count">
                Show
                <select value={runCount} onChange={handleRunCountChange} aria-label="Number of runs">
                  <option value={1}>1</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </label>
            </div>
            <p className="scl-timezone">Times in local time zone: <strong>{localTimeZone()}</strong></p>
            <ol className="scl-runs-list">
              {runs.map((r, i) => (
                <li key={i}>
                  <span className="scl-run-abs">{r.absolute}</span>
                  <span className="scl-run-rel">({r.relative})</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <aside className="scl-sidebar">
          <section className="scl-examples" aria-label="Examples">
            <h2>Examples</h2>
            <ul className="scl-examples-list">
              {EXAMPLES.map((ex) => (
                <li key={ex.key}>
                  <button
                    type="button"
                    className={`scl-example-btn ${expression === ex.expression ? 'active' : ''}`}
                    onClick={() => handleExampleClick(ex)}
                    title={ex.description}
                  >
                    <code>{ex.expression}</code>
                    <span>{ex.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="scl-reference" aria-label="Reference">
            <details open={showReference} onToggle={() => setShowReference(!showReference)}>
              <summary>{REFERENCE.title}</summary>
              <p>{REFERENCE.intro}</p>
              <table className="scl-ref-table">
                <thead><tr><th>Field</th><th>Values</th><th>Special</th><th>Example</th></tr></thead>
                <tbody>
                  {REFERENCE.fields.map((f, i) => (
                    <tr key={i}>
                      <td>{f.label}</td>
                      <td>{f.values}</td>
                      <td>{f.special}</td>
                      <td><code>{f.example}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4>Special characters</h4>
              <dl className="scl-special">
                {REFERENCE.specialChars.map((s, i) => (
                  <React.Fragment key={i}>
                    <dt><code>{s.char}</code></dt>
                    <dd>{s.meaning}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          </section>

          <section className="scl-tips" aria-label="Tips">
            <details open={showTips} onToggle={() => setShowTips(!showTips)}>
              <summary>Tips & gotchas</summary>
              <dl className="scl-tips-list">
                {TIPS.map((t, i) => (
                  <React.Fragment key={i}>
                    <dt>{t.title}</dt>
                    <dd>{t.body}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          </section>
        </aside>
      </main>

      <footer className="scl-footer">
        <p>
          AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit{' '}
          <a href="https://aaronwiseai.com/" target="_blank" rel="noopener">https://aaronwiseai.com/</a>
        </p>
        <p>Part of the AaronWiseAI open-source tool collection — <a href="https://aaronwiseai.com/" target="_blank" rel="noopener">https://aaronwiseai.com/</a></p>
      </footer>
    </div>
  );
}

export default App;