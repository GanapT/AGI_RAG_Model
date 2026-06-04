const tokenKey = 'gt_admin_token';

async function adminApi(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

function pretty(data) {
  return JSON.stringify(data, null, 2);
}

async function loadDashboard() {
  const analytics = document.querySelector('#analytics-output');
  const requests = document.querySelector('#requests-output');
  analytics.textContent = 'Loading...';
  requests.textContent = 'Loading...';

  try {
    const [analyticsData, requestData] = await Promise.all([
      adminApi('/admin/analytics?days=30'),
      adminApi('/api/collab')
    ]);
    analytics.textContent = pretty(analyticsData);
    requests.textContent = pretty(requestData);
  } catch (err) {
    analytics.textContent = err.error || 'Unable to load analytics.';
    requests.textContent = err.error || 'Unable to load requests.';
  }
}

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#login-status');
  const password = new FormData(event.currentTarget).get('password');
  status.textContent = 'Logging in...';

  try {
    const data = await adminApi('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    localStorage.setItem(tokenKey, data.token);
    status.textContent = 'Logged in.';
    await loadDashboard();
  } catch (err) {
    status.textContent = err.error || 'Login failed.';
  }
});

if (localStorage.getItem(tokenKey)) {
  loadDashboard();
}
