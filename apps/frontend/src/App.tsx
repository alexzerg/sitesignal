import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, Text } from "@react-three/drei";

type Incident = {
  id: string;
  zoneId: string;
  category: string;
  description: string;
  status: string;
  reportCount: number;
  updatedAt: string;
};

type ZoneId = "zone-a" | "zone-b" | "zone-c";
type Vec3 = [number, number, number];

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const zoneCenters: Record<ZoneId, Vec3> = {
  "zone-a": [-8, 0, 0],
  "zone-b": [0, 0, 0],
  "zone-c": [8, 0, 0]
};
const signalSlots: Record<ZoneId, Vec3[]> = {
  "zone-a": [[-1.3, 1.5, -0.7], [0.9, 0.8, 0.4], [-0.2, 2.3, 0.7], [1.2, 1.2, -0.8]],
  "zone-b": [[-1.4, 0.7, -0.4], [0.8, 0.7, 0.6], [1.4, 0.5, -0.8], [-0.5, 1.1, 0.9]],
  "zone-c": [[-1.5, 0.5, -0.6], [0.4, 0.6, 0.8], [1.4, 0.4, -0.7], [0.2, 1.1, -0.1]]
};

function colorFor(status?: string) {
  if (status === "RESOLVED") return "#22c55e";
  if (status === "ACKNOWLEDGED") return "#eab308";
  if (status === "CORROBORATED") return "#f97316";
  if (status === "REPORTED") return "#ef4444";
  return "#334155";
}

function Label({ title, subtitle }: { title: string; subtitle: string }) {
  return <group position={[0, 3.25, 0]}>
    <Text fontSize={0.38} color="#f8fafc" anchorX="center" anchorY="middle">{title}</Text>
    <Text position={[0, -0.48, 0]} fontSize={0.16} color="#94a3b8" anchorX="center" anchorY="middle">{subtitle}</Text>
  </group>;
}

function HospitalZone() {
  return <group position={zoneCenters["zone-a"]}>
    <Label title="ZONE A · HOSPITAL" subtitle="Emergency care campus" />
    <mesh position={[0, -0.35, 0]}><boxGeometry args={[6.4, 0.12, 5.2]} /><meshStandardMaterial color="#172554" /></mesh>
    {[0, 1, 2].map((floor) => <mesh key={floor} position={[-0.25, floor * 0.62 + 0.05, 0]}><boxGeometry args={[3.9, 0.52, 2.6]} /><meshStandardMaterial color={floor === 2 ? "#bfdbfe" : "#60a5fa"} transparent opacity={0.82} /></mesh>)}
    <mesh position={[2.2, 0.55, 0.2]}><boxGeometry args={[1.4, 1.5, 2.2]} /><meshStandardMaterial color="#93c5fd" /></mesh>
    <mesh position={[-2.3, -0.08, -1.45]}><boxGeometry args={[1.8, 0.12, 1.1]} /><meshStandardMaterial color="#ef4444" /></mesh>
    <Text position={[-2.3, 0.05, -1.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="white" anchorX="center">ER</Text>
    <mesh position={[1.9, -0.03, -1.55]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.75, 0.75, 0.08, 32]} /><meshStandardMaterial color="#0f172a" /></mesh>
    <Text position={[1.9, 0.04, -1.55]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#fbbf24" anchorX="center">H</Text>
    {[-2.4, -1.7, 2.7].map((x) => <group key={x} position={[x, 0.15, 1.7]}><mesh><cylinderGeometry args={[0.18, 0.24, 0.8, 10]} /><meshStandardMaterial color="#475569" /></mesh><mesh position={[0, 0.55, 0]}><coneGeometry args={[0.45, 0.8, 10]} /><meshStandardMaterial color="#166534" /></mesh></group>)}
  </group>;
}

function CampusBuilding({ position, size, color }: { position: Vec3; size: Vec3; color: string }) {
  return <group position={position}><mesh position={[0, size[1] / 2 - 0.3, 0]}><boxGeometry args={size} /><meshStandardMaterial color={color} /></mesh><mesh position={[0, size[1] + 0.02 - 0.3, 0]}><boxGeometry args={[size[0] * 0.72, 0.12, size[2] * 0.72]} /><meshStandardMaterial color="#334155" /></mesh></group>;
}

function Tree({ position }: { position: Vec3 }) {
  return <group position={position}><mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.09, 0.12, 0.5, 8]} /><meshStandardMaterial color="#78350f" /></mesh><mesh position={[0, 0.72, 0]}><coneGeometry args={[0.42, 0.95, 8]} /><meshStandardMaterial color="#15803d" /></mesh></group>;
}

function CampusZone() {
  const trees: Vec3[] = [[-2.5, 0, -1.8], [-1.8, 0, 1.8], [1.8, 0, 1.7], [2.5, 0, -1.5]];
  return <group position={zoneCenters["zone-b"]}>
    <Label title="ZONE B · UNIVERSITY" subtitle="Campus and public spaces" />
    <mesh position={[0, -0.35, 0]}><boxGeometry args={[6.4, 0.12, 5.2]} /><meshStandardMaterial color="#14532d" /></mesh>
    <mesh position={[0, -0.25, 0]}><boxGeometry args={[1.0, 0.05, 5.1]} /><meshStandardMaterial color="#475569" /></mesh>
    <mesh position={[0, -0.24, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[1.0, 0.05, 6.2]} /><meshStandardMaterial color="#475569" /></mesh>
    <CampusBuilding position={[0, 0, 0]} size={[2.1, 1.8, 1.6]} color="#f59e0b" />
    <CampusBuilding position={[-2.0, 0, 0.9]} size={[1.4, 1.1, 1.2]} color="#fbbf24" />
    <CampusBuilding position={[2.0, 0, -0.9]} size={[1.6, 1.25, 1.1]} color="#fde68a" />
    {trees.map((position, index) => <Tree key={index} position={position} />)}
  </group>;
}

function BeachZone() {
  return <group position={zoneCenters["zone-c"]}>
    <Label title="ZONE C · BEACH" subtitle="Shoreline and adjacent infrastructure" />
    <mesh position={[0, -0.35, 0]}><boxGeometry args={[6.4, 0.12, 5.2]} /><meshStandardMaterial color="#facc15" /></mesh>
    <mesh position={[1.9, -0.22, 0]}><boxGeometry args={[2.4, 0.08, 5.1]} /><meshStandardMaterial color="#0ea5e9" transparent opacity={0.82} /></mesh>
    <mesh position={[-0.15, -0.2, -1.8]}><boxGeometry args={[0.25, 0.12, 4.3]} /><meshStandardMaterial color="#64748b" /></mesh>
    <mesh position={[0.45, -0.05, 0.75]}><boxGeometry args={[0.55, 0.9, 0.55]} /><meshStandardMaterial color="#dc2626" /></mesh>
    <mesh position={[0.45, 0.5, 0.75]}><boxGeometry args={[1.2, 0.1, 0.1]} /><meshStandardMaterial color="#f8fafc" /></mesh>
    <mesh position={[0.45, 0.95, 0.75]}><boxGeometry args={[0.1, 0.9, 0.1]} /><meshStandardMaterial color="#f8fafc" /></mesh>
    <mesh position={[0.45, -0.12, 2.0]}><boxGeometry args={[0.45, 0.2, 2.1]} /><meshStandardMaterial color="#92400e" /></mesh>
    <CampusBuilding position={[-1.9, 0, -1.3]} size={[1.2, 0.8, 0.8]} color="#fb923c" />
    <mesh position={[-1.9, 0.15, 0.95]}><cylinderGeometry args={[0.6, 0.6, 0.25, 24]} /><meshStandardMaterial color="#f8fafc" /></mesh>
  </group>;
}

function SignalMarker({ incident, position }: { incident: Incident; position: Vec3 }) {
  const color = colorFor(incident.status);
  return <Float speed={2} rotationIntensity={0.15} floatIntensity={0.35} position={position}>
    <mesh><sphereGeometry args={[0.25, 20, 20]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} /></mesh>
    <Text position={[0, 0.46, 0]} fontSize={0.14} color={color} anchorX="center" anchorY="middle">{incident.id}</Text>
  </Float>;
}

function SpatialMap({ incidents }: { incidents: Incident[] }) {
  const offsets: Record<ZoneId, number> = { "zone-a": 0, "zone-b": 0, "zone-c": 0 };
  const markers = incidents.map((incident) => {
    const zone = (incident.zoneId in zoneCenters ? incident.zoneId : "zone-b") as ZoneId;
    const slot = signalSlots[zone][offsets[zone]++ % signalSlots[zone].length];
    const center = zoneCenters[zone];
    return { incident, position: [center[0] + slot[0], center[1] + slot[1], center[2] + slot[2]] as Vec3 };
  });

  return <Canvas camera={{ position: [0, 11, 22], fov: 48 }}>
    <color attach="background" args={["#07111f"]} />
    <ambientLight intensity={1.8} />
    <directionalLight position={[0, 12, 8]} intensity={3.5} />
    <pointLight position={[-8, 4, 2]} color="#60a5fa" intensity={18} distance={12} />
    <pointLight position={[8, 4, 2]} color="#facc15" intensity={12} distance={12} />
    <group rotation={[-0.22, 0, 0]}>
      <HospitalZone />
      <CampusZone />
      <BeachZone />
      {markers.map(({ incident, position }) => <SignalMarker key={incident.id} incident={incident} position={position} />)}
    </group>
    <OrbitControls enablePan={false} minDistance={13} maxDistance={30} />
  </Canvas>;
}

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const response = await fetch(`${API}/api/incidents`);
      if (!response.ok) throw new Error(`API ${response.status}`);
      setIncidents(await response.json());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable");
    }
  }

  async function updateIncident(id: string, action: "acknowledge" | "resolve") {
    await fetch(`${API}/api/incidents/${id}/${action}`, { method: "POST" });
    await load();
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 2000); return () => window.clearInterval(timer); }, []);

  return <main>
    <header><div><p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p><h1>Voice-powered incident reporting</h1><p className="subtitle">Hospital, campus and shoreline signals on one spatial operations map.</p></div><span className="pill">{incidents.length} active signals</span></header>
    <section className="layout">
      <div className="map-card"><SpatialMap incidents={incidents} /></div>
      <aside className="panel"><div className="panel-heading"><h2>Incident queue</h2><button onClick={load}>Refresh</button></div>{error && <p className="error">{error}</p>}{incidents.length === 0 && !error && <p className="empty">No incidents. Call the SiteSignal number to report one.</p>}{incidents.map(incident => <article className="incident" key={incident.id}><div className="incident-top"><strong>{incident.id}</strong><span className="status" style={{ color: colorFor(incident.status) }}>{incident.status}</span></div><h3>{incident.zoneId} · {incident.category}</h3><p>{incident.description}</p><small>{incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}</small>{incident.status !== "RESOLVED" && <div className="actions">{incident.status === "REPORTED" || incident.status === "CORROBORATED" ? <button onClick={() => updateIncident(incident.id, "acknowledge")}>Acknowledge</button> : null}<button onClick={() => updateIncident(incident.id, "resolve")}>Resolve</button></div>}</article>)}</aside>
    </section>
  </main>;
}
