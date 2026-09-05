import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

type Incident = {
  id: string; zoneId: string; category: string; description: string;
  status: string; reportCount: number; updatedAt: string;
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const zones = [
  { id: "zone-a", label: "Zone A", position: [-2.2, 0, 0] as [number, number, number] },
  { id: "zone-b", label: "Zone B", position: [0, 0, 0] as [number, number, number] },
  { id: "zone-c", label: "Zone C", position: [2.2, 0, 0] as [number, number, number] }
];

function colorFor(status?: string) {
  if (status === "RESOLVED") return "#22c55e";
  if (status === "ACKNOWLEDGED") return "#eab308";
  if (status === "CORROBORATED") return "#f97316";
  if (status === "REPORTED") return "#ef4444";
  return "#334155";
}

function Zone({ zone, incident }: { zone: typeof zones[number]; incident?: Incident }) {
  return <group position={zone.position}>
    <mesh position={[0, -0.35, 0]}>
      <boxGeometry args={[1.7, 0.15, 1.5]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
    <Text position={[0, 0.05, 0]} fontSize={0.22} color="white" anchorX="center" anchorY="middle">{zone.label}</Text>
    {incident && <mesh position={[0, 0.55, 0]}>
      <sphereGeometry args={[0.28, 24, 24]} />
      <meshStandardMaterial color={colorFor(incident.status)} emissive={colorFor(incident.status)} emissiveIntensity={0.4} />
    </mesh>}
  </group>;
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
    <header><div><p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p><h1>Voice-powered incident reporting</h1><p className="subtitle">Report physical-space problems by phone. Resolve them on a live 3D map.</p></div><span className="pill">{incidents.length} active signals</span></header>
    <section className="layout">
      <div className="map-card"><Canvas camera={{ position: [0, 4.5, 6], fov: 45 }}>
        <color attach="background" args={["#07111f"]} /><ambientLight intensity={1.5} /><directionalLight position={[2, 5, 3]} intensity={3} />
        <group rotation={[-0.25, 0, 0]}>{zones.map(zone => <Zone key={zone.id} zone={zone} incident={incidents.find(item => item.zoneId === zone.id)} />)}</group>
        <OrbitControls enablePan={false} />
      </Canvas></div>
      <aside className="panel"><div className="panel-heading"><h2>Incident queue</h2><button onClick={load}>Refresh</button></div>{error && <p className="error">{error}</p>}{incidents.length === 0 && !error && <p className="empty">No incidents. Call the SiteSignal number to report one.</p>}{incidents.map(incident => <article className="incident" key={incident.id}><div className="incident-top"><strong>{incident.id}</strong><span className="status" style={{ color: colorFor(incident.status) }}>{incident.status}</span></div><h3>{incident.zoneId} · {incident.category}</h3><p>{incident.description}</p><small>{incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}</small>{incident.status !== "RESOLVED" && <div className="actions">{incident.status === "REPORTED" || incident.status === "CORROBORATED" ? <button onClick={() => updateIncident(incident.id, "acknowledge")}>Acknowledge</button> : null}<button onClick={() => updateIncident(incident.id, "resolve")}>Resolve</button></div>}</article>)}</aside>
    </section>
  </main>;
}
