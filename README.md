# Ganap Tewary Personal Website

Express-powered personal research site and portfolio API for `ganaptewary.com`.

## Local Development

```bash
npm install
cp .env.example .env
npm run hash-password
npm run dev
```

Set `JWT_SECRET` and `ADMIN_PASSWORD_HASH` in `.env` before starting the app.

Open:

- Site: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`
- Admin: `http://localhost:3001/admin.html`

## Hostinger Deployment

### Node.js App

1. Connect this GitHub repository in Hostinger.
2. Set the Node.js app entry point to `server.js`.
3. Set Node.js to version 18 or newer.
4. Add the environment variables from `.env.example` in Hostinger.
5. Run `npm install` in the Hostinger terminal if the panel does not install automatically.
6. Restart the Node.js app.

The app serves the website at `/` and the API at `/api/*`.

### Static GitHub Builder

If Hostinger shows a build screen with framework presets, use:

- Framework preset: `Other`
- Branch: `main`
- Node version: `18.x`
- Build command: `npm run build`
- Output directory: `dist`

Static builder deployments serve the visible website only. The API, admin dashboard data, analytics storage, and contact form require the Node.js app deployment.
