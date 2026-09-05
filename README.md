# SiteSignal

**Report physical-space problems by phone. Resolve them on a live 3D map.**

SiteSignal is a DIALED IN Builder Challenge project built around a phone-first operational workflow. A caller reports an incident through Vonage Voice API, confirms the normalized summary and zone code, and the incident appears on a live Three.js/WebXR operations map.

## Current vertical slice

- Fastify backend with health, webhook, incident, confirmation and dispatcher routes.
- Deterministic zone-code validation and 15-minute duplicate/corroboration grouping.
- React + Three.js dashboard with live polling placeholder.
- Firestore-backed incident storage in Cloud Run; local development falls back to memory when `USE_FIRESTORE=false`.
- No credentials are committed. See `.env.example`.

## GCP deployment

Project: `sitesignal-alexzerg-2026`

- Frontend — [Cloud Run](https://sitesignal-frontend-bk2663eh3a-uc.a.run.app)
- Backend — [Cloud Run](https://sitesignal-backend-bk2663eh3a-uc.a.run.app)
- Firestore Native mode — incidents and audit events
- Secret Manager — reserved for Vonage credentials
- Artifact Registry — backend and frontend images

Firebase Hosting is optional; Cloud Run currently serves the HTTPS frontend without requiring an additional Firebase CLI login.

## Local development

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:8080`  
Frontend: `http://localhost:5173`

Create a local demo incident:

```bash
curl -X POST http://localhost:8080/api/incidents \\
  -H 'content-type: application/json' \\
  -d '{"zoneId":"zone-b","zoneCode":"4821","category":"access","description":"Broken access reader","confirmed":true}'
```

## Status model

`AWAITING_CONFIRMATION → REPORTED → CORROBORATED → ACKNOWLEDGED → RESOLVED`

Invalid zone codes and unconfirmed calls do not create incidents.
