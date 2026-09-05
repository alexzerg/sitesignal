import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import crypto from "node:crypto";
import {
  deletePendingCall,
  findActiveDuplicate,
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
const zoneCodes: Record<string, string> = { "zone-a": "123" };

const InputSchema = z.object({
  call_uuid: z.string().optional(),
  speech: z.string().optional(),
  dtmf: z.string().optional(),
  zoneId: z.string().optional(),
  zoneCode: z.string().optional(),
  category: z.enum(["security", "access", "equipment", "safety", "cleaning"]).optional(),
  description: z.string().optional(),
  confirmed: z.boolean().optional()
});

function now() { return new Date().toISOString(); }
function nextId() { return `INC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`; }

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

function parseReport(speechText: string): Pick<PendingCall, "zoneId" | "category" | "description"> | undefined {
  const normalized = speechText.toLowerCase();
  const zoneMatch = normalized.match(/zone\s*([abc])/i);
  const zoneId = zoneMatch ? `zone-${zoneMatch[1].toLowerCase()}` : undefined;
  const category: IncidentCategory | undefined =
    /security|aggressive|patient|fight|threat|violence|behavior|guard/.test(normalized) ? "security" :
    /access|reader|door|badge|entry/.test(normalized) ? "access" :
    /equipment|machine|screen|device/.test(normalized) ? "equipment" :
    /safety|smoke|fire|hazard|blocked/.test(normalized) ? "safety" :
    /clean|spill|trash|waste/.test(normalized) ? "cleaning" : undefined;
  if (!zoneId || !category) return undefined;
  return { zoneId, category, description: speechText.trim() };
}

async function recordIncident(input: {
  zoneId: string;
  category: IncidentCategory;
  description: string;
  zoneCode: string;
  callerConfirmed: boolean;
  actor: "PHONE" | "API";
}) {
  const zoneCodeValid = input.zoneCode === zoneCodes[input.zoneId];
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

  const incident: Incident = {
    id: nextId(), siteId: "demo-site", zoneId: input.zoneId, category: input.category,
    description: input.description, status: "REPORTED", reportCount: 1,
    zoneCodeValid, callerConfirmed: input.callerConfirmed,
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

app.post("/webhooks/events", async (_request, reply) => {
  return reply.code(204).send();
});

app.post("/webhooks/input", async (request, reply) => {
  const { callUuid, speechText, digits } = extractVoiceInput(request.body);
  if (!callUuid) return reply.type("application/json").send(speechNcco("I could not identify this call. Please call again."));

  const pending = await getPendingCall(callUuid);
  if (!pending && speechText) {
    const parsed = parseReport(speechText);
    if (!parsed) return reply.type("application/json").send(speechNcco("Please say a zone, such as Zone B, and describe the problem, such as a broken access reader."));
    const next: PendingCall = { callUuid, ...parsed, stage: "awaiting_zone_code", updatedAt: now() };
    await savePendingCall(next);
    return reply.type("application/json").send(digitsNcco(`I heard ${parsed.zoneId.replace("zone-", "Zone ")} and ${parsed.description}. Enter the three digit operational code for this hospital, then press hash.`, 3, true));
  }

  if (!pending) return reply.type("application/json").send(speechNcco("Please describe the incident again."));

  if (pending.stage === "awaiting_zone_code") {
    if (!digits || digits !== zoneCodes[pending.zoneId]) {
      return reply.type("application/json").send(digitsNcco("That operational code was not accepted. Enter the three digit hospital code again, then press hash.", 3, true));
    }
    pending.zoneCode = digits;
    pending.stage = "awaiting_confirmation";
    pending.updatedAt = now();
    await savePendingCall(pending);
    return reply.type("application/json").send(confirmationNcco(pending));
  }

  if (pending.stage === "awaiting_confirmation" && digits === "1" && pending.zoneCode) {
    const result = await recordIncident({ ...pending, zoneCode: pending.zoneCode, callerConfirmed: true, actor: "PHONE" });
    await deletePendingCall(callUuid);
    if ("error" in result) return reply.type("application/json").send(speechNcco("The incident could not be verified. Please call again."));
    return reply.type("application/json").send([{ action: "talk", text: `Your incident ${result.incident.id} has been reported. Thank you.`, language: "en-US", style: 2 }]);
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
    actor: "API"
  });
  if ("error" in result) return reply.code(422).send(result);
  return reply.code(result.duplicate ? 200 : 201).send(result.incident);
});

app.post("/api/incidents/:id/:action", async (request, reply) => {
  const params = z.object({ id: z.string(), action: z.enum(["acknowledge", "resolve"]) }).parse(request.params);
  const incident = await getIncident(params.id);
  if (!incident) return reply.code(404).send({ error: "incident_not_found" });
  const timestamp = now();
  incident.status = params.action === "acknowledge" ? "ACKNOWLEDGED" : "RESOLVED";
  incident.updatedAt = timestamp;
  incident.audit.push({ at: timestamp, action: incident.status, actor: "DISPATCHER" });
  await saveIncident(incident);
  return incident;
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: "0.0.0.0" });
