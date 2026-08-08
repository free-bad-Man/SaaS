# 3VE.4 AdTech Platform

A commercial landing page and browser-based product demo spanning traffic ingestion, postbacks, IVT control, attribution, CPA/ROAS analytics, spend optimization, and DSP connectors. IVT Guard remains available as a standalone platform module.

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

The site does not collect personal data or connect to advertising accounts. The primary contact actions open the provider profile on Freelance.ru. All metrics shown in the demo are synthetic and match the reproducible sample included with the project.
