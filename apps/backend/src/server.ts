import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import crypto from "node:crypto";

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" });
const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const webhookUrl = (path: string) => `${publicBaseUrl}${path}`;

const Status = z.enum([
  "AWAITING_CONFIRMATION",
  "REPORTED",
  "CORROBORATED",
  "ACKNOWLEDGED",
  "RESOLVED",
  "REJECTED",
  "DUPLICATE",
  "EXPIRED"
]);

type Incident = {
  id: string;
  siteId: string;
  zoneId: string;
  category: "access" | "equipment" | "safety" | "cleaning";
  description: string;
  status: z.infer<typeof Status>;
  reportCount: number;
  zoneCodeValid: boolean;
  callerConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  audit: Array<{ at: string; action: string; actor: string }>;
};

const incidents = new Map<string, Incident>();
const zoneCodes: Record<string, string> = { "zone-a": "1732", "zone-b": "4821", "zone-c": "9054" };

const InputSchema = z.object({
  call_uuid: z.string().optional(),
  speech: z.string().optional(),
  dtmf: z.string().optional(),
  zoneId: z.string().optional(),
  zoneCode: z.string().optional(),
  category: z.enum(["access", "equipment", "safety", "cleaning"]).optional(),
  description: z.string().optional(),
  confirmed: z.boolean().optional()
});

function now() { return new Date().toISOString(); }
function nextId() { return `INC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`; }

function ncco(message: string) {
  return [
    { action: "talk", text: message, language: "en-US", style: 2 },
    { action: "input", type: ["dtmf", "speech"], dtmf: { maxDigits: 1, timeOut: 5 }, speech: { endOnSilence: 1, language: "en-US" }, eventUrl: [webhookUrl("/webhooks/input")] }
  ];
}

app.get("/health", async () => ({ ok: true, service: "sitesignal-backend", time: now() }));

app.get("/webhooks/answer", async (_request, reply) => {
  return reply.type("application/json").send(ncco("Welcome to SiteSignal. Tell us the zone and problem, then confirm the summary."));
});

app.post("/webhooks/input", async (request, reply) => {
  const input = InputSchema.parse(request.body ?? {});
  return reply.type("application/json").send(ncco(`I heard ${input.speech ?? "your input"}. Press 1 to confirm or 2 to try again.`));
});

app.get("/api/incidents", async () => Array.from(incidents.values()));

app.post("/api/incidents", async (request, reply) => {
  const input = InputSchema.parse(request.body ?? {});
  const zoneId = input.zoneId ?? "zone-b";
  const category = input.category ?? "access";
  const description = input.description ?? input.speech ?? "Reported physical-space issue";
  const zoneCodeValid = input.zoneCode === zoneCodes[zoneId];
  const timestamp = now();
  const duplicate = Array.from(incidents.values()).find((incident) =>
    incident.zoneId === zoneId && incident.category === category &&
    incident.status !== "RESOLVED" &&
    Date.parse(timestamp) - Date.parse(incident.updatedAt) < 15 * 60 * 1000
  );

  if (!zoneCodeValid || input.confirmed !== true) {
    return reply.code(422).send({ error: "incident_requires_valid_zone_code_and_confirmation" });
  }

  if (duplicate) {
    duplicate.reportCount += 1;
    duplicate.status = "CORROBORATED";
    duplicate.updatedAt = timestamp;
    duplicate.audit.push({ at: timestamp, action: "CORROBORATED_BY_RELATED_REPORT", actor: "PHONE" });
    return reply.code(200).send(duplicate);
  }

  const incident: Incident = {
    id: nextId(), siteId: "demo-site", zoneId, category, description,
    status: "REPORTED", reportCount: 1, zoneCodeValid, callerConfirmed: true,
    createdAt: timestamp, updatedAt: timestamp,
    audit: [{ at: timestamp, action: "REPORTED_BY_PHONE", actor: "PHONE" }]
  };
  incidents.set(incident.id, incident);
  return reply.code(201).send(incident);
});

app.post("/api/incidents/:id/:action", async (request, reply) => {
  const params = z.object({ id: z.string(), action: z.enum(["acknowledge", "resolve"]) }).parse(request.params);
  const incident = incidents.get(params.id);
  if (!incident) return reply.code(404).send({ error: "incident_not_found" });
  const timestamp = now();
  incident.status = params.action === "acknowledge" ? "ACKNOWLEDGED" : "RESOLVED";
  incident.updatedAt = timestamp;
  incident.audit.push({ at: timestamp, action: incident.status, actor: "DISPATCHER" });
  return incident;
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: "0.0.0.0" });
