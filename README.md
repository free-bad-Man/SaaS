# 3VE.4 AdTech Platform

A commercial landing page and working customer platform spanning traffic ingestion, postbacks, IVT control, attribution, CPA/ROAS analytics, spend optimization, and DSP connectors. IVT Guard remains available as a standalone platform module. The private product includes invite-only customer accounts, isolated projects, usage limits, signed sessions, and an operator control center.

## Local development

```bash
npm ci
npm run dev
```

On Windows with Docker Desktop, use `npm run dev:docker`. A local TCP proxy exposes the development server at `http://localhost:3000`.

Production validation:

```bash
npm test
```

The public demo is synthetic and does not connect to advertising accounts. Invited customer workspaces retain account email, password hashes, project metadata, usage totals, policies, and aggregate run results. Raw uploaded files are removed after processing. The primary contact actions open adminez.sh.
