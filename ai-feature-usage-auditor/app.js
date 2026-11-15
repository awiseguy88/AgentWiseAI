(function () {
  const STORAGE_KEY = 'aiFeatureUsageAuditor.v1';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { tools: [] };
    } catch {
      return { tools: [] };
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function parseFeatures(input) {
    return input.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, used: true, frequency: 'Weekly' }));
  }

  function currency(n) {
    const num = Number(n) || 0;
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let state = load();

  const form = document.getElementById('tool-form');
  const tableWrap = document.getElementById('tools-table-wrap');
  const empty = document.getElementById('tools-empty');
  const summaryEl = document.getElementById('report-summary');
  const pointsEl = document.getElementById('talking-points');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('tool-name').value.trim();
    const premium = parseFloat(document.getElementById('tool-premium').value || '0');
    const term = document.getElementById('tool-term').value.trim() || 'term';
    const renewal = document.getElementById('tool-renewal').value;
    const features = parseFeatures(document.getElementById('tool-features').value);
    if (!name || features.length === 0) return;

    const existing = state.tools.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.premium = premium;
      existing.term = term;
      existing.renewalDate = renewal;
      // merge features: keep usage for matching names, add new
      const byName = new Map(existing.features.map(f => [f.name.toLowerCase(), f]));
      existing.features = features.map(f => byName.get(f.name.toLowerCase()) || f);
    } else {
      state.tools.push({ id: uid(), name, premium, term, renewalDate: renewal, features });
    }
    save(state);
    form.reset();
    render();
  });

  function updateFeature(toolId, idx, patch) {
    const tool = state.tools.find(t => t.id === toolId);
    if (!tool || !tool.features[idx]) return;
    Object.assign(tool.features[idx], patch);
    save(state);
    render();
  }

  function removeTool(toolId) {
    state.tools = state.tools.filter(t => t.id !== toolId);
    save(state);
    render();
  }

  function computeReport() {
    let totalPremium = 0, totalFeatures = 0, usedFeatures = 0, unusedFeatures = 0, unusedValue = 0;
    const unusedDetails = [];
    const upcomingRenewals = [];
    const today = new Date();
    state.tools.forEach(tool => {
      totalPremium += Number(tool.premium) || 0;
      const perFeature = tool.features.length ? (Number(tool.premium) || 0) / tool.features.length : 0;
      tool.features.forEach(f => {
        totalFeatures += 1;
        if (f.used) usedFeatures += 1;
        else {
          unusedFeatures += 1;
          unusedValue += perFeature;
          unusedDetails.push({ tool: tool.name, feature: f.name, value: perFeature, term: tool.term, renewal: tool.renewalDate });
        }
      });
      if (tool.renewalDate) {
        const d = new Date(tool.renewalDate + 'T00:00:00');
        const days = Math.ceil((d - today) / 86400000);
        if (days >= -30 && days <= 120) upcomingRenewals.push({ tool: tool.name, date: tool.renewalDate, days });
      }
    });
    return { totalPremium, totalFeatures, usedFeatures, unusedFeatures, unusedValue, unusedDetails, upcomingRenewals };
  }

  function buildTalkingPoints(report) {
    const pts = [];
    if (state.tools.length === 0) {
      pts.push('Log your SaaS tools and AI features to generate negotiation talking points.');
      return pts;
    }
    if (report.unusedFeatures > 0) {
      pts.push(`You pay for ${report.totalFeatures} AI features but only use ${report.usedFeatures}. Ask to remove or discount the ${report.unusedFeatures} unused feature(s), representing about ${currency(report.unusedValue)} per term in paid-but-unused AI value.`);
    } else {
      pts.push('All logged AI features are marked as used. Use adoption frequency data to justify keeping current pricing or consolidating overlapping tools.');
    }
    const topUnused = report.unusedDetails.slice(0, 5).map(d => `${d.feature} (${d.tool}, ~${currency(d.value)}/${d.term})`);
    if (topUnused.length) {
      pts.push('Cite specific unused features in renewal talks: ' + topUnused.join('; ') + '.');
    }
    pts.push('Vendors have added 20–37% AI premiums while infrastructure costs have fallen; request itemized AI pricing and a credit for features your team does not adopt.');
    if (report.upcomingRenewals.length) {
      const r = report.upcomingRenewals.sort((a,b)=>a.days-b.days).map(x => `${x.tool} renews ${x.date}`).join('; ');
      pts.push('Prepare before renewal dates: ' + r + '. Bring this paid-vs-used report to the negotiation.');
    } else {
      pts.push('Set renewal dates for each tool so you can bring usage evidence before price increases take effect.');
    }
    return pts;
  }

  function render() {
    // table
    if (state.tools.length === 0) {
      empty.classList.remove('hidden');
      tableWrap.classList.add('hidden');
      tableWrap.innerHTML = '';
    } else {
      empty.classList.add('hidden');
      tableWrap.classList.remove('hidden');
      let html = '<table><thead><tr><th>Tool</th><th>AI premium</th><th>Renewal</th><th>AI feature</th><th>Used?</th><th>Frequency</th><th></th></tr></thead><tbody>';
      state.tools.forEach(tool => {
        tool.features.forEach((f, idx) => {
          html += `<tr data-tool="${tool.id}" data-idx="${idx}">`;
          if (idx === 0) {
            html += `<td rowspan="${tool.features.length}"><strong>${escapeHtml(tool.name)}</strong><br><button class="small-btn danger remove-tool" data-id="${tool.id}">Remove tool</button></td>`;
            html += `<td rowspan="${tool.features.length}">${currency(tool.premium)} / ${escapeHtml(tool.term)}</td>`;
            html += `<td rowspan="${tool.features.length}">${escapeHtml(tool.renewalDate || '—')}</td>`;
          }
          html += `<td>${escapeHtml(f.name)}</td>`;
          html += `<td>
            <select class="used-select">
              <option value="used" ${f.used ? 'selected' : ''}>Used</option>
              <option value="unused" ${!f.used ? 'selected' : ''}>Unused</option>
            </select>
          </td>`;
          html += `<td>
            <select class="freq-select" ${!f.used ? 'disabled' : ''}>
              ${['Daily','Weekly','Monthly','Rarely','Never'].map(opt => `<option value="${opt}" ${f.frequency===opt?'selected':''}>${opt}</option>`).join('')}
            </select>
          </td>`;
          if (idx === 0) html += `<td rowspan="${tool.features.length}"><span class="${tool.features.some(x=>!x.used)?'status-unused':'status-used'}">${tool.features.filter(x=>!x.used).length} unused</span></td>`;
          html += '</tr>';
        });
      });
      html += '</tbody></table>';
      tableWrap.innerHTML = html;

      tableWrap.querySelectorAll('.used-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const tr = e.target.closest('tr');
          updateFeature(tr.dataset.tool, Number(tr.dataset.idx), { used: e.target.value === 'used', frequency: e.target.value === 'used' ? 'Weekly' : 'Never' });
        });
      });
      tableWrap.querySelectorAll('.freq-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const tr = e.target.closest('tr');
          updateFeature(tr.dataset.tool, Number(tr.dataset.idx), { frequency: e.target.value });
        });
      });
      tableWrap.querySelectorAll('.remove-tool').forEach(btn => {
        btn.addEventListener('click', () => removeTool(btn.dataset.id));
      });
    }

    // report
    const report = computeReport();
    summaryEl.innerHTML = `
      <div class="metric"><div class="label">Tools logged</div><div class="value">${state.tools.length}</div></div>
      <div class="metric"><div class="label">AI premium (total / term values)</div><div class="value">${currency(report.totalPremium)}</div></div>
      <div class="metric"><div class="label">Features paid for</div><div class="value">${report.totalFeatures}</div></div>
      <div class="metric"><div class="label">Features used</div><div class="value">${report.usedFeatures}</div></div>
      <div class="metric"><div class="label">Features unused</div><div class="value">${report.unusedFeatures}</div></div>
      <div class="metric"><div class="label">Estimated unused AI spend</div><div class="value">${currency(report.unusedValue)}</div></div>
    `;
    pointsEl.innerHTML = buildTalkingPoints(report).map(p => `<li>${escapeHtml(p)}</li>`).join('');
  }

  function toCsv() {
    const rows = [['Tool','AI premium','Billing term','Renewal date','AI feature','Used','Frequency','Allocated feature value']];
    state.tools.forEach(tool => {
      const per = tool.features.length ? (Number(tool.premium)||0)/tool.features.length : 0;
      tool.features.forEach(f => {
        rows.push([tool.name, tool.premium, tool.term, tool.renewalDate || '', f.name, f.used ? 'Yes' : 'No', f.frequency || '', per.toFixed(2)]);
      });
    });
    const report = computeReport();
    rows.push([]);
    rows.push(['Report summary','','','','','','','']);
    rows.push(['Tools logged', state.tools.length]);
    rows.push(['Total AI premium', report.totalPremium.toFixed(2)]);
    rows.push(['Features paid for', report.totalFeatures]);
    rows.push(['Features used', report.usedFeatures]);
    rows.push(['Features unused', report.unusedFeatures]);
    rows.push(['Estimated unused AI spend', report.unusedValue.toFixed(2)]);
    rows.push([]);
    rows.push(['Negotiation talking points']);
    buildTalkingPoints(report).forEach(p => rows.push([p]));
    return rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"').join(',')).join('\n');
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById('export-csv').addEventListener('click', () => {
    download('ai-feature-usage-report.csv', toCsv(), 'text/csv;charset=utf-8');
  });

  document.getElementById('export-pdf').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('clear-all').addEventListener('click', () => {
    if (!confirm('Clear all logged tools and usage data?')) return;
    state = { tools: [] };
    save(state);
    render();
  });

  // expose minimal API for smoke checks
  window.AIFeatureUsageAuditor = {
    _state: () => state,
    _setState: (s) => { state = s; save(state); render(); },
    _computeReport: computeReport,
    _buildTalkingPoints: buildTalkingPoints,
    _toCsv: toCsv,
    _storageKey: STORAGE_KEY
  };

  render();
})();
