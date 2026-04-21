# GT Backend — Frontend Integration Reference
> Hand this file to Claude when building the frontend.  
> Base URL (production): `https://ganaptewary.com/api`  
> Base URL (local dev):   `http://localhost:3001/api`

---

## Quick Start — paste this in your frontend

```js
const API = 'https://ganaptewary.com/api'; // change for local dev

async function api(path, opts = {}) {
  const token = localStorage.getItem('gt_admin_token');
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

---

## 1. Analytics — track user events

### Track a page view (call on every page load)
```js
// Call immediately when page loads
navigator.sendBeacon(`${API}/analytics/track`, JSON.stringify({
  event: 'pageview',
  page: window.location.pathname,
  referrer: document.referrer,
}));

// OR with fetch
await api('/analytics/track', {
  method: 'POST',
  body: JSON.stringify({ event: 'pageview', page: '/', referrer: document.referrer }),
});
```

### Track resume download (add to your download button)
```js
document.getElementById('resumeDownloadBtn').addEventListener('click', () => {
  api('/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ event: 'resume_download', page: '/' }),
  });
});
```

### Track section scroll-into-view
```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      api('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          event: 'section_view',
          page: '/',
          section: entry.target.id, // 'research', 'publications', etc.
        }),
      });
      observer.unobserve(entry.target); // only count once
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('section[id]').forEach(s => observer.observe(s));
```

### GET public summary (use for a subtle stats widget if desired)
```
GET /api/analytics/summary
```
```json
{
  "totalViews": 1240,
  "resumeDownloads": 87,
  "last7Days": [
    { "day": "2026-04-15", "visits": 28 },
    { "day": "2026-04-16", "visits": 41 }
  ]
}
```

---

## 2. Publications — replace hardcoded HTML

### Fetch all publications
```
GET /api/publications
```
```json
[
  {
    "id": 1,
    "title": "AQR-HNSW: Accelerating Approximate Nearest Neighbor Search...",
    "venue": "Design and Automation Conference (DAC) 2026",
    "status": "SUBMITTED",
    "arxiv_url": null,
    "doi_url": null,
    "tags": ["HNSW", "Vector Quantization", "SIMD", "C++"],
    "coauthors": [],
    "abstract": null,
    "submitted_at": null,
    "accepted_at": null,
    "sort_order": 0,
    "updated_at": "2026-04-21T10:00:00Z"
  },
  ...
]
```

### Render publications dynamically (example)
```js
async function loadPublications() {
  const pubs = await api('/publications');
  const container = document.getElementById('publications-container');

  container.innerHTML = pubs.map(pub => `
    <div class="publication-card">
      <span class="pub-status pub-${pub.status.toLowerCase()}">${pub.status}</span>
      <h3 class="pub-title">${pub.title}</h3>
      <p class="pub-venue">${pub.venue}</p>
      ${pub.arxiv_url ? `<a href="${pub.arxiv_url}" target="_blank">arXiv →</a>` : ''}
      ${pub.doi_url   ? `<a href="${pub.doi_url}"   target="_blank">DOI →</a>`   : ''}
      <div class="tech-stack">
        ${pub.tags.map(t => `<span class="tech-tag">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

loadPublications();
```

### Status values and their CSS classes
| status      | CSS class suggestion      | Meaning                         |
|-------------|---------------------------|---------------------------------|
| `ONGOING`   | `pub-ongoing`  (green)    | Work in progress                |
| `SUBMITTED` | `pub-submitted` (yellow)  | Under review                    |
| `ACCEPTED`  | `pub-accepted`  (blue)    | Accepted ✓                      |
| `REJECTED`  | `pub-rejected`  (red)     | Not accepted, may be resubmitted|

---

## 3. Site Status — live badges & thesis bar

### Fetch all status values
```
GET /api/status
```
```json
{
  "open_to_work":   true,
  "open_to_collab": true,
  "thesis_chapter": 2,
  "thesis_total":   5,
  "thesis_current": "FPGA Datapath Design",
  "defense_date":   "2026-04-30",
  "current_focus":  "FPGA-Accelerated HNSW for sub-μs vector search",
  "available_from": "Summer 2026"
}
```

### Use it in the frontend
```js
async function loadStatus() {
  const s = await api('/status');

  // Green dot in nav
  const dot = document.getElementById('open-to-work-badge');
  if (dot) dot.style.display = s.open_to_work ? 'inline-block' : 'none';

  // Thesis progress bar
  const pct = Math.round((s.thesis_chapter / s.thesis_total) * 100);
  document.getElementById('thesis-bar').style.width = `${pct}%`;
  document.getElementById('thesis-label').textContent =
    `Chapter ${s.thesis_chapter}/${s.thesis_total} — ${s.thesis_current}`;

  // Current focus text (hero or about section)
  document.getElementById('current-focus').textContent = s.current_focus;

  // Defense countdown
  const daysLeft = Math.ceil((new Date(s.defense_date) - Date.now()) / 86_400_000);
  if (daysLeft > 0) {
    document.getElementById('defense-countdown').textContent =
      `Defending in ${daysLeft} days`;
  }
}
loadStatus();
```

### Fetch Opportunities section
```
GET /api/status/opportunities
```
```json
{
  "headline":    "Summer 2026 ML Engineering Internship",
  "focus_areas": [
    "HNSW and vector database optimizations",
    "Large-scale recommendation systems",
    "LLMs and RAG systems",
    "Model architecture optimization",
    "Hardware-accelerated ML"
  ],
  "note": "Open to research collaborations..."
}
```

```js
async function loadOpportunities() {
  const opp = await api('/status/opportunities');
  document.getElementById('opp-headline').textContent = opp.headline;
  document.getElementById('opp-note').textContent = opp.note;

  const list = document.getElementById('opp-focus-list');
  list.innerHTML = opp.focus_areas.map(f => `<li>${f}</li>`).join('');
}
loadOpportunities();
```

---

## 4. Conference Deadlines — countdown timers

### Fetch all deadlines
```
GET /api/deadlines
```
```json
[
  {
    "id": 1,
    "conf": "NeurIPS 2026",
    "deadline": "2026-05-17",
    "notification_date": "2026-09-01",
    "camera_ready_date": null,
    "status": "targeting",
    "url": "https://neurips.cc",
    "notes": null,
    "days_left": 26,
    "is_past": false
  }
]
```

### Render countdown cards
```js
async function loadDeadlines() {
  const deadlines = await api('/deadlines');
  const container = document.getElementById('deadlines-container');

  container.innerHTML = deadlines
    .filter(d => !d.is_past || d.status === 'submitted' || d.status === 'accepted')
    .map(d => `
      <div class="deadline-card status-${d.status}">
        <span class="conf-status">${d.status.toUpperCase()}</span>
        <h4>${d.url ? `<a href="${d.url}" target="_blank">${d.conf}</a>` : d.conf}</h4>
        <p class="deadline-date">Deadline: ${d.deadline}</p>
        ${d.days_left !== null
          ? `<p class="days-left">${d.days_left} days left</p>`
          : `<p class="days-left past">Deadline passed</p>`
        }
        ${d.notification_date ? `<p class="notif-date">Notification: ${d.notification_date}</p>` : ''}
      </div>
    `).join('');
}
loadDeadlines();
```

### Status values for deadlines
| status      | Meaning                          |
|-------------|----------------------------------|
| `targeting` | Planning to submit               |
| `submitted` | Paper under review               |
| `accepted`  | Accepted 🎉                      |
| `rejected`  | Not accepted                     |

---

## 5. Collaboration Request Form

### Submit a collab request
```
POST /api/collab
```
```js
async function submitCollabRequest(formData) {
  const { name, email, institution, type, area, message } = formData;
  try {
    await api('/collab', {
      method: 'POST',
      body: JSON.stringify({ name, email, institution, type, area, message }),
    });
    showSuccess('Request sent! Ganap will be in touch.');
  } catch (err) {
    showError(err.error || 'Something went wrong.');
  }
}
```

### Request body
```json
{
  "name":        "Dr. Jane Smith",
  "email":       "jane@mit.edu",
  "institution": "MIT CSAIL",
  "type":        "joint_paper",
  "area":        "Approximate Nearest Neighbor Search",
  "message":     "I read your AQR-HNSW paper and would love to collaborate..."
}
```

### type values
| value         | Label         |
|---------------|---------------|
| `joint_paper` | Joint Paper   |
| `internship`  | Internship    |
| `consult`     | Consultation  |
| `general`     | General       |

---

## 6. Admin Panel (protected routes)

All admin routes require `Authorization: Bearer <token>` header.

### Login
```
POST /admin/login
Body: { "password": "your_password" }
```
```json
{ "token": "eyJhbG...", "expires_in": 86400 }
```
```js
async function adminLogin(password) {
  const BASE = 'https://ganaptewary.com'; // no /api prefix for admin
  const res = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  localStorage.setItem('gt_admin_token', data.token);
  return data;
}
```

### Admin: full analytics
```
GET /admin/analytics?days=30
```
Returns rich breakdown: by_day, by_page, by_device, by_country, by_referrer, by_section

### Admin: update publication status
```
PATCH /api/publications/:id
Body: { "status": "ACCEPTED", "arxiv_url": "https://arxiv.org/abs/xxxx.xxxxx" }
```

### Admin: update site status
```
PATCH /api/status
Body: { "open_to_work": true, "thesis_chapter": 3, "current_focus": "..." }
```

### Admin: update opportunities section
```
PATCH /api/status/opportunities
Body: {
  "headline":    "Fall 2026 Research Positions",
  "focus_areas": ["HNSW optimization", "RAG systems"],
  "note":        "Currently accepting PhD collaborators."
}
```

### Admin: view collab requests
```
GET /api/collab                    — all requests
GET /api/collab?status=pending     — filter by status
PATCH /api/collab/:id              — Body: { "status": "replied" }
DELETE /api/collab/:id             — remove request
```

### Admin: manage deadlines
```
POST   /api/deadlines   — add deadline
PATCH  /api/deadlines/:id
DELETE /api/deadlines/:id
```
```js
// Add a deadline
await api('/deadlines', {
  method: 'POST',
  body: JSON.stringify({
    conf:              'ISCA 2027',
    deadline:          '2026-11-15',
    notification_date: '2027-03-01',
    status:            'targeting',
    url:               'https://iscaconf.org',
  }),
});
```

---

## 7. Deployment checklist (Hostinger)

```
1. Upload /backend folder to your Hostinger Node.js app directory
2. Set Node.js version to 22.x in Hostinger panel
3. Set entry point to: server.js
4. Add environment variables in Hostinger panel (from .env.example)
5. Run in Hostinger SSH terminal:
      npm install
      node scripts/hash-password.js   ← generates ADMIN_PASSWORD_HASH
      npm start
6. Your API is live at: https://ganaptewary.com/api/health
```

### Hostinger Node.js app port note
Hostinger assigns a port automatically via `process.env.PORT`.
Your `server.js` already reads `process.env.PORT || 3001` — this is correct.

---

## 8. Error format (all endpoints)

All errors return:
```json
{ "error": "Human-readable error message" }
```
HTTP status codes used: `200 201 400 401 404 500`

---

## 9. CORS

In production, set `ALLOWED_ORIGIN=https://ganaptewary.com` in `.env`.  
For local dev, set `ALLOWED_ORIGIN=*` or `http://localhost:3000`.
