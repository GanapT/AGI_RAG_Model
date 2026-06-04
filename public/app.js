const API = '';

const fallbackPublications = [
  {
    title: 'AQR-HNSW: Accelerating Approximate Nearest Neighbor Search via Density-aware Quantization and Multi-stage Re-ranking',
    venue: 'Design and Automation Conference (DAC) 2026',
    status: 'SUBMITTED',
    tags: ['HNSW', 'Vector Quantization', 'SIMD', 'C++']
  },
  {
    title: 'FPGA-Accelerated HNSW: Hardware Implementation for Ultra-Low Latency Vector Search',
    venue: "Master's Thesis | Target: IEEE FCCM RCC 2026",
    status: 'ONGOING',
    tags: ['FPGA', 'Verilog', 'HLS', 'Xilinx']
  },
  {
    title: 'NEXUS-NAS: Multi-Fidelity Bayesian Optimization for Hardware-Aware Neural Architecture Search',
    venue: 'Target: NeurIPS 2026',
    status: 'ONGOING',
    tags: ['AutoML', 'Bayesian Opt', 'GNN', 'PyTorch']
  },
  {
    title: 'METIS-Graph: Adaptive Multi-Source RAG with Graph-Aware Autoscaling',
    venue: 'Target: International Conference on Supercomputing (ICS) 2026',
    status: 'ONGOING',
    tags: ['RAG', 'Knowledge Graph', 'Autoscaling', 'LLMs']
  }
];

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

function text(value, fallback = '') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function renderPublications(publications) {
  const list = document.querySelector('#publications-list');
  list.innerHTML = publications.map(pub => `
    <article class="publication-card">
      <span class="status-pill">${escapeHtml(text(pub.status, 'ONGOING'))}</span>
      <h3>${escapeHtml(pub.title)}</h3>
      <p>${escapeHtml(pub.venue)}</p>
      <div class="tag-list">
        ${(pub.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function renderDeadlines(deadlines) {
  const list = document.querySelector('#deadlines-list');
  if (!deadlines.length) {
    list.innerHTML = '<article class="deadline-card"><strong>No deadlines posted yet.</strong><p>Targets can be added from the admin API.</p></article>';
    return;
  }

  list.innerHTML = deadlines.slice(0, 6).map(item => {
    const url = safeUrl(item.url);
    const conf = escapeHtml(item.conf);
    return `
      <article class="deadline-card">
        <strong>${url ? `<a href="${url}" rel="noreferrer" target="_blank">${conf}</a>` : conf}</strong>
        <p>${escapeHtml(text(item.status, 'targeting').toUpperCase())} | ${escapeHtml(item.deadline)}</p>
      <p>${item.days_left === null ? 'Deadline passed' : `${item.days_left} days left`}</p>
      </article>
    `;
  }).join('');
}

async function loadStatus() {
  try {
    const status = await api('/api/status');
    document.querySelector('#availability-text').textContent = status.open_to_work ? 'Open to ML systems work' : 'Focused on current research';
    document.querySelector('#availability-dot').style.background = status.open_to_work ? 'var(--ok)' : 'var(--accent-2)';
    document.querySelector('#current-focus').textContent = text(status.current_focus);
    document.querySelector('#available-from').textContent = text(status.available_from);

    const chapter = Number(status.thesis_chapter || 0);
    const total = Number(status.thesis_total || 1);
    const pct = Math.max(0, Math.min(100, Math.round((chapter / total) * 100)));
    document.querySelector('#thesis-bar').style.width = `${pct}%`;
    document.querySelector('#thesis-label').textContent = `Chapter ${chapter}/${total} - ${text(status.thesis_current)}`;
  } catch {
    document.querySelector('#thesis-bar').style.width = '40%';
  }
}

async function loadOpportunities() {
  try {
    const opp = await api('/api/status/opportunities');
    document.querySelector('#opp-headline').textContent = text(opp.headline);
    document.querySelector('#opp-note').textContent = text(opp.note);
    document.querySelector('#opp-focus-list').innerHTML = (opp.focus_areas || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  } catch {
    document.querySelector('#opp-focus-list').innerHTML = [
      'HNSW and vector database optimizations',
      'Large-scale recommendation systems',
      'LLMs and RAG systems',
      'Hardware-accelerated ML'
    ].map(item => `<li>${item}</li>`).join('');
  }
}

async function loadPublications() {
  try {
    renderPublications(await api('/api/publications'));
  } catch {
    renderPublications(fallbackPublications);
  }
}

async function loadDeadlines() {
  try {
    renderDeadlines(await api('/api/deadlines'));
  } catch {
    renderDeadlines([]);
  }
}

function setupContactForm() {
  const form = document.querySelector('#collab-form');
  const status = document.querySelector('#form-status');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    status.textContent = 'Sending...';

    try {
      await api('/api/collab', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      status.textContent = 'Request sent. Thank you.';
    } catch (err) {
      status.textContent = err.error || 'Could not send request.';
    }
  });
}

function trackAnalytics() {
  const body = JSON.stringify({ event: 'pageview', page: location.pathname, referrer: document.referrer });
  navigator.sendBeacon?.('/api/analytics/track', new Blob([body], { type: 'application/json' }));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      api('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ event: 'section_view', page: location.pathname, section: entry.target.id })
      }).catch(() => {});
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
}

loadStatus();
loadOpportunities();
loadPublications();
loadDeadlines();
setupContactForm();
trackAnalytics();
