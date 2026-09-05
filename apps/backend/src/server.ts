import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import crypto from "node:crypto";
import {
  deleteAllIncidents,
  deleteIncident,
  deletePendingCall,
  findActiveDuplicate,
  findIncidentByCallUuid,
  getIncident,
  getPendingCall,
  listIncidents,
  saveIncident,
  savePendingCall,
  storageMode,
  type Incident,
  type IncidentCategory,
  type PendingCall
} from "./store.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" });
const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const webhookUrl = (path: string) => `${publicBaseUrl}${path}`;
const zoneCodes: Record<string, string[]> = { "zone-a": ["123", "3414"] };
const locationCodeMap: Record<string, string> = { "3414": "emergency_entrance" };
function isValidZoneCode(zoneId: string, code: string) { return zoneCodes[zoneId]?.includes(code) === true; }

const InputSchema = z.object({
  call_uuid: z.string().optional(),
  speech: z.string().optional(),
  dtmf: z.string().optional(),
  zoneId: z.string().optional(),
  zoneCode: z.string().optional(),
  category: z.enum(["security", "access", "equipment", "safety", "cleaning"]).optional(),
  description: z.string().optional(),
  locationId: z.string().optional(),
  confirmed: z.boolean().optional()
});

function now() { return new Date().toISOString(); }
function nextId() { return `INC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`; }
function nextCallIncidentId(callUuid: string) { return `CALL-${callUuid.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase()}`; }

function inputNcco(message: string, types: Array<"dtmf" | "speech">, maxDigits?: number, submitOnHash = false) {
  return [
    { action: "talk", text: message, language: "en-US", style: 2 },
    {
      action: "input",
      type: types,
      dtmf: { maxDigits, submitOnHash, timeOut: 10 },
      speech: { endOnSilence: 1, language: "en-US" },
      eventUrl: [webhookUrl("/webhooks/input")]
    }
  ];
}

function speechNcco(message: string) {
  return inputNcco(message, ["speech"]);
}

function digitsNcco(message: string, maxDigits: number, submitOnHash = false) {
  return inputNcco(message, ["dtmf"], maxDigits, submitOnHash);
}

function confirmationNcco(pending: PendingCall) {
  return digitsNcco(
    `I heard ${pending.zoneId.replace("zone-", "Zone ")} and ${pending.description}. Press 1 to confirm this incident, or 2 to start again.`,
    1
  );
}

function extractVoiceInput(body: unknown) {
  const raw = body as Record<string, unknown>;
  const speech = raw.speech as { results?: Array<{ text?: string }> } | string | undefined;
  const dtmf = raw.dtmf as { digits?: string } | string | undefined;
  const uuid = raw.uuid;
  const callUuid = typeof uuid === "string" ? uuid : Array.isArray(uuid) && typeof uuid[0] === "string" ? uuid[0] : typeof raw.call_uuid === "string" ? raw.call_uuid : undefined;
  const speechText = typeof speech === "string" ? speech : speech?.results?.[0]?.text;
  const digits = typeof dtmf === "string" ? dtmf : dtmf?.digits;
  return { callUuid, speechText, digits };
}

function parseReport(speechText: string): Pick<PendingCall, "zoneId" | "category" | "description" | "locationId"> | undefined {
  const normalized = speechText.toLowerCase();
  const zoneMatch = normalized.match(/zone\s*([abc])/i);
  const zoneId = zoneMatch ? `zone-${zoneMatch[1].toLowerCase()}` : undefined;
  const locationId = /emergency|a\s*&\s*e|ambulance/.test(normalized) ? "emergency_entrance" :
    /helipad|helicopter/.test(normalized) ? "helipad" :
    /security gate|guard post|guard house/.test(normalized) ? "security_gate" :
    /parking|car park/.test(normalized) ? "parking_central" :
    /pharmacy|cafe|café|shop/.test(normalized) ? "pharmacy_cafe" :
    /laboratory|lab/.test(normalized) ? "laboratory" :
    /cardiology|critical care/.test(normalized) ? "cardiology" : undefined;
  const category: IncidentCategory | undefined =
    /security|aggressive|patient|fight|threat|violence|behavior|guard/.test(normalized) ? "security" :
    /access|reader|door|badge|entry/.test(normalized) ? "access" :
    /equipment|machine|screen|device/.test(normalized) ? "equipment" :
    /safety|smoke|fire|hazard|blocked/.test(normalized) ? "safety" :
    /clean|spill|trash|waste/.test(normalized) ? "cleaning" : undefined;
  if (!zoneId || !category) return undefined;
  return { zoneId, category, locationId, description: speechText.trim() };
}

async function recordIncident(input: {
  zoneId: string;
  category: IncidentCategory;
  description: string;
  zoneCode: string;
  callerConfirmed: boolean;
  actor: "PHONE" | "API";
  incidentId?: string;
  callUuid?: string;
  locationId?: string;
}) {
  const zoneCodeValid = isValidZoneCode(input.zoneId, input.zoneCode);
  if (!zoneCodeValid || !input.callerConfirmed) return { error: "incident_requires_valid_zone_code_and_confirmation" as const };

  const timestamp = now();
  const duplicate = await findActiveDuplicate(input.zoneId, input.category, timestamp);
  if (duplicate) {
    duplicate.reportCount += 1;
    duplicate.status = "CORROBORATED";
    duplicate.updatedAt = timestamp;
    duplicate.audit.push({ at: timestamp, action: "CORROBORATED_BY_RELATED_REPORT", actor: input.actor });
    await saveIncident(duplicate);
    return { incident: duplicate, duplicate: true as const };
  }

  if (input.incidentId) {
    const existing = await getIncident(input.incidentId);
    if (existing) {
      existing.status = "REPORTED";
      existing.zoneCodeValid = true;
      existing.callerConfirmed = true;
      existing.source = input.actor;
      existing.callUuid = input.callUuid;
      existing.locationId = input.locationId;
      existing.updatedAt = timestamp;
      existing.audit.push({ at: timestamp, action: "REPORTED_BY_PHONE", actor: input.actor });
      await saveIncident(existing);
      return { incident: existing, duplicate: false as const };
    }
  }

  const incident: Incident = {
    id: input.incidentId ?? nextId(), siteId: "demo-site", zoneId: input.zoneId, category: input.category,
    description: input.description, status: "REPORTED", reportCount: 1,
    zoneCodeValid, callerConfirmed: input.callerConfirmed, source: input.actor, callUuid: input.callUuid,
    locationId: input.locationId,
    createdAt: timestamp, updatedAt: timestamp,
    audit: [{ at: timestamp, action: "REPORTED_BY_PHONE", actor: input.actor }]
  };
  await saveIncident(incident);
  return { incident, duplicate: false as const };
}

app.get("/health", async () => ({ ok: true, service: "sitesignal-backend", storage: storageMode, time: now() }));

app.get("/webhooks/answer", async (_request, reply) => {
  return reply.type("application/json").send(speechNcco("Welcome to SiteSignal. Tell us the zone and problem."));
});

app.post("/webhooks/events", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const callUuid = typeof body.uuid === "string" ? body.uuid : typeof body.call_uuid === "string" ? body.call_uuid : undefined;
  const status = typeof body.status === "string" ? body.status.toLowerCase() : "";
  if (callUuid && ["started", "ringing", "answered"].includes(status)) {
    const existing = await findIncidentByCallUuid(callUuid);
    if (!existing) {
      const timestamp = now();
      await saveIncident({
        id: nextCallIncidentId(callUuid), siteId: "demo-site", zoneId: "zone-a",
        category: "security", description: "Incoming call — waiting for caller description",
        status: "AWAITING_CONFIRMATION", reportCount: 1, zoneCodeValid: false,
        callerConfirmed: false, source: "PHONE", callUuid,
        createdAt: timestamp, updatedAt: timestamp,
        audit: [{ at: timestamp, action: "CALL_RECEIVED", actor: "PHONE" }]
      });
    }
  }
  return reply.code(204).send();
});

app.post("/webhooks/input", async (request, reply) => {
  const { callUuid, speechText, digits } = extractVoiceInput(request.body);
  if (!callUuid) return reply.type("application/json").send(speechNcco("I could not identify this call. Please call again."));

  const pending = await getPendingCall(callUuid);
  if (!pending && speechText) {
    const parsed = parseReport(speechText);
    if (!parsed) return reply.type("application/json").send(speechNcco("Please say a zone, such as Zone B, and describe the problem, such as a broken access reader."));
    const existingCall = await findIncidentByCallUuid(callUuid);
    const timestamp = now();
    const pendingIncident: Incident = existingCall ?? {
      id: nextCallIncidentId(callUuid), siteId: "demo-site", zoneId: parsed.zoneId,
      category: parsed.category, description: parsed.description,
      status: "AWAITING_CONFIRMATION", reportCount: 1, zoneCodeValid: false,
      callerConfirmed: false, source: "PHONE", callUuid,
      createdAt: timestamp, updatedAt: timestamp,
      audit: [{ at: timestamp, action: "CALL_RECEIVED", actor: "PHONE" }]
    };
    pendingIncident.zoneId = parsed.zoneId;
    pendingIncident.category = parsed.category;
    pendingIncident.description = parsed.description;
    pendingIncident.locationId = parsed.locationId;
    pendingIncident.status = "AWAITING_CONFIRMATION";
    pendingIncident.updatedAt = timestamp;
    await saveIncident(pendingIncident);
    const next: PendingCall = { callUuid, incidentId: pendingIncident.id, ...parsed, stage: "awaiting_zone_code", updatedAt: timestamp };
    await savePendingCall(next);
    return reply.type("application/json").send(digitsNcco(`I heard ${parsed.zoneId.replace("zone-", "Zone ")} and ${parsed.description}. Enter the location code printed on the wall, for example 3414, then press hash.`, 4, true));
  }

  if (!pending) return reply.type("application/json").send(speechNcco("Please describe the incident again."));

  if (pending.stage === "awaiting_zone_code") {
    if (!digits || !isValidZoneCode(pending.zoneId, digits)) {
      return reply.type("application/json").send(digitsNcco("That location code was not accepted. Enter the four digit code printed on the wall again, then press hash.", 4, true));
    }
    pending.zoneCode = digits;
    if (locationCodeMap[digits]) pending.locationId = locationCodeMap[digits];
    pending.stage = "awaiting_confirmation";
    pending.updatedAt = now();
    if (pending.incidentId) {
      const pendingIncident = await getIncident(pending.incidentId);
      if (pendingIncident) {
        pendingIncident.zoneCodeValid = true;
        pendingIncident.updatedAt = pending.updatedAt;
        pendingIncident.audit.push({ at: pending.updatedAt, action: "LOCATION_CODE_ACCEPTED", actor: "PHONE" });
        await saveIncident(pendingIncident);
      }
    }
    await savePendingCall(pending);
    return reply.type("application/json").send(confirmationNcco(pending));
  }

  if (pending.stage === "awaiting_confirmation" && digits === "1" && pending.zoneCode) {
    const result = await recordIncident({ ...pending, zoneCode: pending.zoneCode, callerConfirmed: true, actor: "PHONE", incidentId: pending.incidentId, callUuid });
    await deletePendingCall(callUuid);
    if ("error" in result) return reply.type("application/json").send(speechNcco("The incident could not be verified. Please call again."));
    if (result.duplicate && pending.incidentId) await deleteIncident(pending.incidentId);
    return reply.type("application/json").send([{ action: "talk", text: `Your incident ${result.incident.id} has been reported. Thank you.`, language: "en-US", style: 2 }]);
  }

  if (pending.incidentId) {
    const rejected = await getIncident(pending.incidentId);
    if (rejected) {
      rejected.status = "REJECTED";
      rejected.updatedAt = now();
      rejected.audit.push({ at: rejected.updatedAt, action: "CALL_CANCELLED", actor: "PHONE" });
      await saveIncident(rejected);
    }
  }
  await deletePendingCall(callUuid);
  return reply.type("application/json").send(speechNcco("The report was cancelled. Please describe the incident again."));
});

app.get("/api/incidents", async () => listIncidents());

app.post("/api/incidents", async (request, reply) => {
  const input = InputSchema.parse(request.body ?? {});
  const result = await recordIncident({
    zoneId: input.zoneId ?? "zone-a",
    category: input.category ?? "security",
    description: input.description ?? input.speech ?? "Reported physical-space issue",
    zoneCode: input.zoneCode ?? "",
    callerConfirmed: input.confirmed === true,
    actor: "API",
    locationId: input.locationId
  });
  if ("error" in result) return reply.code(422).send(result);
  return reply.code(result.duplicate ? 200 : 201).send(result.incident);
});

app.delete("/api/incidents", async (_request, reply) => {
  const deleted = await deleteAllIncidents();
  return reply.code(200).send({ ok: true, deletedCount: deleted });
});

app.delete("/api/incidents/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const ok = await deleteIncident(params.id);
  return reply.code(ok ? 200 : 404).send({ ok, id: params.id });
});

app.post("/api/incidents/:id/:action", async (request, reply) => {
  const params = z.object({ id: z.string(), action: z.enum(["acknowledge", "resolve", "dispatch_security"]) }).parse(request.params);
  const incident = await getIncident(params.id);
  if (!incident) return reply.code(404).send({ error: "incident_not_found" });
  const timestamp = now();
  if (params.action === "acknowledge") {
    incident.status = "ACKNOWLEDGED";
  } else if (params.action === "resolve") {
    incident.status = "RESOLVED";
  } else if (params.action === "dispatch_security") {
    incident.status = "DISPATCHED_TO_SECURITY";
    incident.securityDispatchedAt = timestamp;
  }
  incident.updatedAt = timestamp;
  incident.audit.push({ at: timestamp, action: incident.status, actor: "DISPATCHER" });
  await saveIncident(incident);
  return incident;
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: "0.0.0.0" });
