import { Firestore } from "@google-cloud/firestore";

export type IncidentStatus =
  | "AWAITING_CONFIRMATION"
  | "REPORTED"
  | "CORROBORATED"
  | "ACKNOWLEDGED"
  | "DISPATCHED_TO_SECURITY"
  | "RESOLVED"
  | "REJECTED"
  | "DUPLICATE"
  | "EXPIRED";

export type IncidentCategory = "security" | "access" | "equipment" | "safety" | "cleaning";

export type Incident = {
  id: string;
  siteId: string;
  zoneId: string;
  category: IncidentCategory;
  description: string;
  status: IncidentStatus;
  reportCount: number;
  zoneCodeValid: boolean;
  callerConfirmed: boolean;
  securityDispatchedAt?: string;
  createdAt: string;
  updatedAt: string;
  audit: Array<{ at: string; action: string; actor: string }>;
  source?: "PHONE" | "API";
  callUuid?: string;
  locationId?: string;
};

export type PendingCall = {
  callUuid: string;
  incidentId?: string;
  locationId?: string;
  zoneId: string;
  category: IncidentCategory;
  description: string;
  zoneCode?: string;
  stage: "awaiting_zone_code" | "awaiting_confirmation";
  updatedAt: string;
};

const memory = new Map<string, Incident>();
const pendingMemory = new Map<string, PendingCall>();
const useFirestore = process.env.USE_FIRESTORE === "true";
const firestore = useFirestore ? new Firestore({ projectId: process.env.GCP_PROJECT_ID }) : undefined;
const collection = () => firestore!.collection("incidents");
const pendingCollection = () => firestore!.collection("callSessions");

export const storageMode = useFirestore ? "firestore" : "memory";

export async function listIncidents(): Promise<Incident[]> {
  if (!firestore) return Array.from(memory.values());
  const snapshot = await collection().orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as Incident);
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  if (!firestore) return memory.get(id);
  const snapshot = await collection().doc(id).get();
  return snapshot.exists ? snapshot.data() as Incident : undefined;
}


export async function findIncidentByCallUuid(callUuid: string): Promise<Incident | undefined> {
  if (!firestore) return Array.from(memory.values()).find((incident) => incident.callUuid === callUuid);
  const snapshot = await collection().where("callUuid", "==", callUuid).limit(1).get();
  return snapshot.empty ? undefined : snapshot.docs[0].data() as Incident;
}

export async function findActiveDuplicate(zoneId: string, category: IncidentCategory, timestamp: string): Promise<Incident | undefined> {
  const cutoff = Date.parse(timestamp) - 15 * 60 * 1000;
  const activeStatuses: IncidentStatus[] = ["REPORTED", "CORROBORATED", "ACKNOWLEDGED"];
  const candidates = !firestore
    ? Array.from(memory.values())
    : (await collection().where("zoneId", "==", zoneId).where("category", "==", category).get()).docs.map((doc) => doc.data() as Incident);

  return candidates.find((incident) =>
    activeStatuses.includes(incident.status) &&
    incident.zoneId === zoneId &&
    incident.category === category &&
    Date.parse(incident.updatedAt) >= cutoff
  );
}

export async function saveIncident(incident: Incident): Promise<void> {
  if (!firestore) {
    memory.set(incident.id, incident);
    return;
  }
  await collection().doc(incident.id).set(incident);
}

export async function savePendingCall(call: PendingCall): Promise<void> {
  if (!firestore) {
    pendingMemory.set(call.callUuid, call);
    return;
  }
  await pendingCollection().doc(call.callUuid).set(call);
}

export async function getPendingCall(callUuid: string): Promise<PendingCall | undefined> {
  if (!firestore) return pendingMemory.get(callUuid);
  const snapshot = await pendingCollection().doc(callUuid).get();
  return snapshot.exists ? snapshot.data() as PendingCall : undefined;
}

export async function deleteIncident(id: string): Promise<boolean> {
  if (!firestore) {
    return memory.delete(id);
  }
  await collection().doc(id).delete();
  return true;
}

export async function deleteAllIncidents(): Promise<number> {
  if (!firestore) {
    const size = memory.size;
    memory.clear();
    return size;
  }
  const snapshot = await collection().get();
  const batch = firestore.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snapshot.size;
}

export async function deletePendingCall(callUuid: string): Promise<void> {
  if (!firestore) {
    pendingMemory.delete(callUuid);
    return;
  }
  await pendingCollection().doc(callUuid).delete();
}
