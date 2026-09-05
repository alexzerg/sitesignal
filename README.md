# SiteSignal

**Report physical-space problems by phone. Resolve them on a live 3D map.**

SiteSignal is a DIALED IN Builder Challenge project built around a phone-first hospital operations workflow. Security, facilities, maintenance and cleaning staff report incidents through Vonage Voice API, confirm the normalized summary and hospital code, and the incident appears on a live Three.js/WebXR operations map.

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
  -d '{"zoneId":"zone-a","zoneCode":"123","category":"security","description":"Aggressive patient near Emergency Bay","confirmed":true}'
```

## Status model

`AWAITING_CONFIRMATION → REPORTED → CORROBORATED → ACKNOWLEDGED → RESOLVED`

Invalid zone codes and unconfirmed calls do not create incidents.

## Vonage voice flow

Configure the Vonage Voice Application with:

```text
Answer URL:
https://sitesignal-backend-bk2663eh3a-uc.a.run.app/webhooks/answer

Event URL:
https://sitesignal-backend-bk2663eh3a-uc.a.run.app/webhooks/events
```

The caller flow is:

```text
1. Call the SiteSignal number.
2. Say: "Aggressive patient in Zone A near the Emergency Bay."
3. Enter the three-digit hospital operational code: 123.
4. Press 1 to confirm.
5. The security incident appears in Firestore and on the 3D map.
```

Hospital demo code:

```text
Zone A / hospital campus: 123
```
