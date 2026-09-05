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

type ZoneId = "zone-a";
type Vec3 = [number, number, number];

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const zoneCenters: Record<ZoneId, Vec3> = { "zone-a": [0, 0, 0] };
const signalSlots: Record<ZoneId, Vec3[]> = {
  "zone-a": [
    [5.0, 0.75, 3.1],    // helipad
    [-5.0, 0.85, -2.8],   // security post
    [-4.0, 0.55, 2.3],    // visitor parking
    [4.0, 0.85, -2.0],    // pharmacy / cafe
    [-1.8, 1.0, 0.2],     // floor 1
    [-1.0, 1.8, 0.2],     // floor 2
    [0.1, 2.6, 0.2],      // floor 3
    [1.2, 3.35, 0.2],     // floor 4
    [0.0, 0.5, 4.0],      // service yard
    [-3.4, 0.45, -0.9]    // emergency bay
  ]
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
  const floors = [0, 1, 2, 3];
  return <group position={zoneCenters["zone-a"]}>
    <Label title="ZONE A · CLEVELAND CLINIC-INSPIRED CAMPUS" subtitle="Fictionalized facilities operations schematic" />
    <mesh position={[0, -0.35, 0]}><boxGeometry args={[15, 0.12, 10]} /><meshStandardMaterial color="#172554" /></mesh>

    {/* Central four-floor transparent hospital */}
    <mesh position={[-0.8, 1.35, 0]}><boxGeometry args={[6.8, 4.55, 4.5]} /><meshPhysicalMaterial color="#93c5fd" transmission={0.82} roughness={0.1} transparent opacity={0.2} side={2} /></mesh>
    {floors.map((floor) => {
      const y = floor * 0.95 + 0.05;
      return <group key={floor} position={[-0.8, y, 0]}>
        <mesh><boxGeometry args={[6.55, 0.12, 4.25]} /><meshStandardMaterial color={floor === 0 ? "#e0f2fe" : "#bfdbfe"} transparent opacity={0.8} /></mesh>
        <Text position={[-3.35, 0.28, 2.3]} fontSize={0.18} color="#e0f2fe" anchorX="center">F{floor + 1}</Text>
        <mesh position={[-2.0, 0.4, 0.5]}><boxGeometry args={[1.55, 0.5, 1.1]} /><meshStandardMaterial color={floor % 2 === 0 ? "#38bdf8" : "#818cf8"} transparent opacity={0.72} /></mesh>
        <mesh position={[0, 0.4, 0.5]}><boxGeometry args={[1.55, 0.5, 1.1]} /><meshStandardMaterial color="#60a5fa" transparent opacity={0.72} /></mesh>
        <mesh position={[1.9, 0.4, 0.5]}><boxGeometry args={[1.2, 0.5, 1.1]} /><meshStandardMaterial color="#c4b5fd" transparent opacity={0.72} /></mesh>
        <mesh position={[0, 0.4, -1.15]}><boxGeometry args={[3.6, 0.5, 0.75]} /><meshStandardMaterial color="#dbeafe" transparent opacity={0.7} /></mesh>
      </group>;
    })}
    <mesh position={[2.5, 1.15, 0]}><boxGeometry args={[1.25, 2.3, 3.2]} /><meshPhysicalMaterial color="#bfdbfe" transmission={0.75} roughness={0.1} transparent opacity={0.28} /></mesh>
    <mesh position={[2.5, 1.15, -0.8]}><boxGeometry args={[0.45, 2.5, 0.45]} /><meshStandardMaterial color="#334155" /></mesh>

    {/* Clinical wing and emergency bay */}
    <mesh position={[4.1, 0.9, 0.3]}><boxGeometry args={[2.4, 2.1, 3.8]} /><meshPhysicalMaterial color="#bae6fd" transmission={0.65} transparent opacity={0.32} /></mesh>
    <mesh position={[-4.3, 0.05, -1.8]}><boxGeometry args={[2.8, 0.12, 1.5]} /><meshStandardMaterial color="#ef4444" /></mesh>
    <Text position={[-4.3, 0.16, -1.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color="white" anchorX="center">EMERGENCY BAY</Text>

    {/* Security gate and visitor parking */}
    <mesh position={[-5.2, 0.3, -3.4]}><boxGeometry args={[1.25, 0.7, 1.1]} /><meshStandardMaterial color="#f59e0b" /></mesh>
    <mesh position={[-5.2, 0.75, -3.4]}><boxGeometry args={[1.05, 0.08, 0.9]} /><meshPhysicalMaterial color="#bae6fd" transmission={0.5} transparent opacity={0.35} /></mesh>
    <Text position={[-5.2, 0.82, -3.4]} fontSize={0.14} color="#111827" anchorX="center">SECURITY</Text>
    <mesh position={[-4.7, -0.05, 2.65]}><boxGeometry args={[4.2, 0.08, 3.3]} /><meshStandardMaterial color="#334155" /></mesh>
    {[-5.8, -4.8, -3.8].map((x) => <mesh key={x} position={[x, 0.02, 2.65]}><boxGeometry args={[0.55, 0.06, 2.8]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
    <Text position={[-4.7, 0.1, 4.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#e2e8f0" anchorX="center">VISITOR PARKING</Text>

    {/* Retail pharmacy / cafe and service yard */}
    <mesh position={[4.25, 0.35, -3.0]}><boxGeometry args={[2.7, 0.8, 1.5]} /><meshStandardMaterial color="#fb923c" /></mesh>
    <Text position={[4.25, 0.82, -3.0]} fontSize={0.2} color="white" anchorX="center">PHARMACY · CAFÉ</Text>
    <mesh position={[0.7, 0.15, 4.0]}><boxGeometry args={[4.5, 0.35, 1.1]} /><meshStandardMaterial color="#64748b" /></mesh>
    <mesh position={[0.7, 0.42, 4.0]}><boxGeometry args={[1.0, 0.25, 0.7]} /><meshStandardMaterial color="#f97316" /></mesh>
    <Text position={[0.7, 0.65, 4.0]} fontSize={0.16} color="#f8fafc" anchorX="center">SERVICE YARD</Text>

    {/* Helipad */}
    <mesh position={[5.0, -0.03, 3.1]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.0, 1.0, 0.1, 32]} /><meshStandardMaterial color="#0f172a" /></mesh>
    <Text position={[5.0, 0.06, 3.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#fbbf24" anchorX="center">H</Text>
    <mesh position={[5.0, 0.1, 3.1]}><boxGeometry args={[0.08, 0.08, 1.5]} /><meshStandardMaterial color="#fbbf24" /></mesh>
    <mesh position={[5.0, 0.1, 3.1]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.08, 0.08, 1.5]} /><meshStandardMaterial color="#fbbf24" /></mesh>

    {[-6.0, -2.8, 3.1].map((x) => <group key={x} position={[x, 0.15, -0.1]}><mesh><cylinderGeometry args={[0.18, 0.24, 0.8, 10]} /><meshStandardMaterial color="#475569" /></mesh><mesh position={[0, 0.55, 0]}><coneGeometry args={[0.45, 0.8, 10]} /><meshStandardMaterial color="#166534" /></mesh></group>)}
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
  const offsets: Record<ZoneId, number> = { "zone-a": 0 };
  const markers = incidents.map((incident) => {
    const zone: ZoneId = "zone-a";
    const slot = signalSlots[zone][offsets[zone]++ % signalSlots[zone].length];
    const center = zoneCenters[zone];
    return { incident, position: [center[0] + slot[0], center[1] + slot[1], center[2] + slot[2]] as Vec3 };
  });

  return <Canvas shadows camera={{ position: [13, 10, 17], fov: 52 }}>
    <color attach="background" args={["#07111f"]} />
    <ambientLight intensity={1.25} />
    <directionalLight position={[4, 14, 8]} intensity={4.5} castShadow />
    <pointLight position={[-8, 5, 2]} color="#60a5fa" intensity={24} distance={16} />
    <pointLight position={[8, 5, 2]} color="#facc15" intensity={18} distance={16} />
    <gridHelper args={[26, 26, "#334155", "#172554"]} position={[0, -0.25, 0]} />
    <group>
      <HospitalZone />
      {markers.map(({ incident, position }) => <SignalMarker key={incident.id} incident={incident} position={position} />)}
    </group>
    <OrbitControls enablePan enableRotate enableZoom enableDamping rotateSpeed={0.85} zoomSpeed={0.85} dampingFactor={0.08} minPolarAngle={0.35} maxPolarAngle={1.48} minDistance={10} maxDistance={42} target={[0, 1.2, 0]} />
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
    <header><div><p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p><h1>Voice-powered incident reporting</h1><p className="subtitle">One large hospital campus: security, facilities, parking, retail, emergency and helipad operations.</p></div><span className="pill">{incidents.length} active signals</span></header>
    <section className="layout">
      <div className="map-card"><SpatialMap incidents={incidents} /><div className="map-hint">Drag to rotate · Scroll to zoom · Right-drag to pan</div></div>
      <aside className="panel"><div className="panel-heading"><h2>Incident queue</h2><button onClick={load}>Refresh</button></div>{error && <p className="error">{error}</p>}{incidents.length === 0 && !error && <p className="empty">No incidents. Call the SiteSignal number to report one.</p>}{incidents.map(incident => <article className="incident" key={incident.id}><div className="incident-top"><strong>{incident.id}</strong><span className="status" style={{ color: colorFor(incident.status) }}>{incident.status}</span></div><h3>{incident.zoneId} · {incident.category}</h3><p>{incident.description}</p><small>{incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}</small>{incident.status !== "RESOLVED" && <div className="actions">{incident.status === "REPORTED" || incident.status === "CORROBORATED" ? <button onClick={() => updateIncident(incident.id, "acknowledge")}>Acknowledge</button> : null}<button onClick={() => updateIncident(incident.id, "resolve")}>Resolve</button></div>}</article>)}</aside>
    </section>
  </main>;
}
