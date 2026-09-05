# SiteSignal

**Report physical-space problems by phone. Resolve them on a live 3D map.**

SiteSignal is a DIALED IN Builder Challenge project built around a phone-first operational workflow. A caller reports an incident through Vonage Voice API, confirms the normalized summary and zone code, and the incident appears on a live Three.js/WebXR operations map.

## Current vertical slice

- Fastify backend with health, webhook, incident, confirmation and dispatcher routes.
- Deterministic zone-code validation and 15-minute duplicate/corroboration grouping.
- React + Three.js dashboard with live polling placeholder; Firestore realtime is the next adapter.
- No credentials are committed. See `.env.example`.

## Planned GCP deployment

- Firebase Hosting — frontend
- Cloud Run — Fastify backend
- Firestore Native mode — incidents and audit events
- Secret Manager — Vonage credentials
- Artifact Registry — backend image

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
