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

// Locations scaled up ~2.8x to match enlarged hospital campus
const signalSlots: Record<ZoneId, Vec3[]> = {
  "zone-a": [
    [-10.5, 0.9, -4.5],   // Emergency Bay
    [-13.0, 1.4, -8.5],   // Security Gate / Post
    [-12.0, 1.0, 6.5],    // Visitor Parking
    [10.5, 1.4, -7.5],    // Pharmacy / Cafe
    [13.0, 1.1, 7.8],     // Helipad
    [-2.0, 2.2, 0.5],     // Floor 1 Central
    [-1.0, 4.4, 0.5],     // Floor 2
    [0.5, 6.6, 0.5],      // Floor 3
    [2.0, 8.8, 0.5],      // Floor 4
    [2.0, 1.2, 10.5],     // Service Yard
    [9.5, 3.0, 0.8]       // Clinical Wing
  ]
};

function colorFor(status?: string) {
  if (status === "RESOLVED") return "#22c55e";
  if (status === "DISPATCHED_TO_SECURITY") return "#f43f5e";
  if (status === "ACKNOWLEDGED") return "#eab308";
  if (status === "CORROBORATED") return "#f97316";
  if (status === "REPORTED") return "#ef4444";
  return "#64748b";
}

function Label({ title, subtitle }: { title: string; subtitle: string }) {
  return <group position={[0, 9.5, 0]}>
    <Text fontSize={0.9} color="#f8fafc" anchorX="center" anchorY="middle">{title}</Text>
    <Text position={[0, -1.1, 0]} fontSize={0.42} color="#94a3b8" anchorX="center" anchorY="middle">{subtitle}</Text>
  </group>;
}

function HospitalZone() {
  const floors = [0, 1, 2, 3];
  return <group position={zoneCenters["zone-a"]}>
    <Label title="ZONE A · CLEVELAND CLINIC-INSPIRED CAMPUS" subtitle="Fictionalized facilities operations schematic" />
    {/* Base campus ground slab - enlarged ~3x (38 x 26) */}
    <mesh position={[0, -0.4, 0]}><boxGeometry args={[38, 0.2, 26]} /><meshStandardMaterial color="#0f172a" roughness={0.7} /></mesh>

    {/* Central 4-floor transparent hospital tower (args: 17 x 11.5 x 11.5) */}
    <mesh position={[-2.0, 4.6, 0]}><boxGeometry args={[17, 11.5, 11.5]} /><meshPhysicalMaterial color="#93c5fd" transmission={0.88} roughness={0.08} transparent opacity={0.22} side={2} /></mesh>
    {floors.map((floor) => {
      const y = floor * 2.45 + 0.8;
      return <group key={floor} position={[-2.0, y, 0]}>
        <mesh><boxGeometry args={[16.4, 0.25, 10.9]} /><meshStandardMaterial color={floor === 0 ? "#e0f2fe" : "#bfdbfe"} transparent opacity={0.82} /></mesh>
        <Text position={[-8.4, 0.7, 5.6]} fontSize={0.48} color="#e0f2fe" anchorX="center">F{floor + 1}</Text>
        <mesh position={[-5.0, 0.9, 1.5]}><boxGeometry args={[3.8, 1.25, 2.8]} /><meshStandardMaterial color={floor % 2 === 0 ? "#38bdf8" : "#818cf8"} transparent opacity={0.75} /></mesh>
        <mesh position={[0, 0.9, 1.5]}><boxGeometry args={[3.8, 1.25, 2.8]} /><meshStandardMaterial color="#60a5fa" transparent opacity={0.75} /></mesh>
        <mesh position={[4.8, 0.9, 1.5]}><boxGeometry args={[3.2, 1.25, 2.8]} /><meshStandardMaterial color="#c4b5fd" transparent opacity={0.75} /></mesh>
        <mesh position={[0, 0.9, -3.0]}><boxGeometry args={[9.0, 1.25, 2.2]} /><meshStandardMaterial color="#dbeafe" transparent opacity={0.7} /></mesh>
      </group>;
    })}

    {/* Elevator core & central shaft */}
    <mesh position={[6.2, 4.2, 0]}><boxGeometry args={[3.2, 6.2, 8.2]} /><meshPhysicalMaterial color="#bfdbfe" transmission={0.75} roughness={0.1} transparent opacity={0.3} /></mesh>
    <mesh position={[6.2, 4.2, -2.0]}><boxGeometry args={[1.2, 7.5, 1.2]} /><meshStandardMaterial color="#334155" /></mesh>

    {/* Clinical wing */}
    <mesh position={[10.5, 2.8, 0.8]}><boxGeometry args={[6.2, 5.5, 9.8]} /><meshPhysicalMaterial color="#bae6fd" transmission={0.68} transparent opacity={0.35} /></mesh>
    <Text position={[10.5, 6.0, 0.8]} fontSize={0.45} color="#38bdf8" anchorX="center">CLINICAL WING</Text>

    {/* Emergency bay */}
    <mesh position={[-10.8, 0.15, -4.5]}><boxGeometry args={[7.2, 0.28, 4.0]} /><meshStandardMaterial color="#ef4444" /></mesh>
    <Text position={[-10.8, 0.35, -4.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color="white" anchorX="center">EMERGENCY BAY</Text>

    {/* Security gate & guard post */}
    <mesh position={[-13.2, 0.8, -8.8]}><boxGeometry args={[3.2, 1.8, 2.8]} /><meshStandardMaterial color="#f59e0b" /></mesh>
    <mesh position={[-13.2, 1.9, -8.8]}><boxGeometry args={[2.7, 0.2, 2.3]} /><meshPhysicalMaterial color="#bae6fd" transmission={0.5} transparent opacity={0.35} /></mesh>
    <Text position={[-13.2, 2.2, -8.8]} fontSize={0.38} color="#111827" anchorX="center">SECURITY GATE</Text>

    {/* Visitor parking */}
    <mesh position={[-12.0, -0.1, 6.8]}><boxGeometry args={[10.5, 0.18, 8.4]} /><meshStandardMaterial color="#334155" /></mesh>
    {[-14.8, -12.2, -9.6].map((x) => <mesh key={x} position={[x, 0.05, 6.8]}><boxGeometry args={[1.4, 0.12, 7.2]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
    <Text position={[-12.0, 0.2, 11.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.52} color="#e2e8f0" anchorX="center">VISITOR PARKING</Text>

    {/* Retail pharmacy / cafe */}
    <mesh position={[10.8, 0.9, -7.5]}><boxGeometry args={[6.8, 2.0, 3.8]} /><meshStandardMaterial color="#fb923c" /></mesh>
    <Text position={[10.8, 2.1, -7.5]} fontSize={0.5} color="white" anchorX="center">PHARMACY · CAFÉ</Text>

    {/* Service yard */}
    <mesh position={[2.0, 0.35, 10.5]}><boxGeometry args={[11.5, 0.85, 2.8]} /><meshStandardMaterial color="#64748b" /></mesh>
    <mesh position={[2.0, 1.0, 10.5]}><boxGeometry args={[2.5, 0.65, 1.8]} /><meshStandardMaterial color="#f97316" /></mesh>
    <Text position={[2.0, 1.6, 10.5]} fontSize={0.42} color="#f8fafc" anchorX="center">SERVICE YARD</Text>

    {/* Helipad */}
    <mesh position={[13.0, -0.05, 7.8]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[2.6, 2.6, 0.25, 32]} /><meshStandardMaterial color="#020617" /></mesh>
    <Text position={[13.0, 0.15, 7.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.15} color="#fbbf24" anchorX="center">H</Text>
    <mesh position={[13.0, 0.22, 7.8]}><boxGeometry args={[0.2, 0.18, 3.8]} /><meshStandardMaterial color="#fbbf24" /></mesh>
    <mesh position={[13.0, 0.22, 7.8]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.2, 0.18, 3.8]} /><meshStandardMaterial color="#fbbf24" /></mesh>

    {/* Trees / landscaping */}
    {[-15.0, -7.0, 7.5, 15.0].map((x) => <group key={x} position={[x, 0.3, -0.5]}><mesh><cylinderGeometry args={[0.4, 0.55, 2.0, 10]} /><meshStandardMaterial color="#475569" /></mesh><mesh position={[0, 1.4, 0]}><coneGeometry args={[1.1, 2.0, 10]} /><meshStandardMaterial color="#166534" /></mesh></group>)}
  </group>;
}

function SignalMarker({
  incident,
  position,
  isSelected,
  onSelect
}: {
  incident: Incident;
  position: Vec3;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = colorFor(incident.status);
  const scale = isSelected ? 1.6 : 1.0;
  return <Float speed={2.5} rotationIntensity={0.2} floatIntensity={0.4} position={position}>
    <group scale={scale} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Outer pulsing ring for selected incident */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.88, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={2} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 1.2 : 0.8} />
      </mesh>
      <Text position={[0, 0.85, 0]} fontSize={0.34} color={isSelected ? "#38bdf8" : color} anchorX="center" anchorY="middle">
        {incident.id}
      </Text>
    </group>
  </Float>;
}

function SpatialMap({
  incidents,
  selectedId,
  onSelect
}: {
  incidents: Incident[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const offsets: Record<ZoneId, number> = { "zone-a": 0 };
  const markers = incidents.map((incident) => {
    const zone: ZoneId = "zone-a";
    const slot = signalSlots[zone][offsets[zone]++ % signalSlots[zone].length];
    const center = zoneCenters[zone];
    return {
      incident,
      position: [center[0] + slot[0], center[1] + slot[1], center[2] + slot[2]] as Vec3
    };
  });

  return <Canvas shadows camera={{ position: [28, 22, 36], fov: 48 }}>
    <color attach="background" args={["#050c18"]} />
    <ambientLight intensity={1.4} />
    <directionalLight position={[10, 30, 18]} intensity={4.8} castShadow />
    <pointLight position={[-18, 12, 4]} color="#60a5fa" intensity={45} distance={38} />
    <pointLight position={[18, 12, 4]} color="#facc15" intensity={38} distance={38} />
    <gridHelper args={[54, 54, "#334155", "#172554"]} position={[0, -0.3, 0]} />
    <group>
      <HospitalZone />
      {markers.map(({ incident, position }) => (
        <SignalMarker
          key={incident.id}
          incident={incident}
          position={position}
          isSelected={incident.id === selectedId}
          onSelect={() => onSelect(incident.id)}
        />
      ))}
    </group>
    {/* Clamped OrbitControls: no underground rotation (polar angle 15°-85°), bounded azimuth (-75°..+75°) */}
    <OrbitControls
      enablePan
      enableRotate
      enableZoom
      enableDamping
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      dampingFactor={0.08}
      minPolarAngle={0.25}
      maxPolarAngle={1.46}
      minAzimuthAngle={-Math.PI / 2.4}
      maxAzimuthAngle={Math.PI / 2.4}
      minDistance={18}
      maxDistance={85}
      target={[0, 2.5, 0]}
    />
  </Canvas>;
}

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const response = await fetch(`${API}/api/incidents`);
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data: Incident[] = await response.json();
      setIncidents(data);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable");
    }
  }

  async function updateIncident(id: string, action: "acknowledge" | "resolve" | "dispatch_security") {
    await fetch(`${API}/api/incidents/${id}/${action}`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const activeCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  return <main>
    <header>
      <div>
        <p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p>
        <h1>Voice-powered incident reporting</h1>
        <p className="subtitle">Cleveland Clinic Main Campus: 4-floor clinical tower, emergency bay, security gate, visitor parking, pharmacy & helipad.</p>
      </div>
      <span className="pill">{activeCount} active signals</span>
    </header>
    <section className="layout">
      <div className="map-card">
        <SpatialMap
          incidents={incidents}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
        <div className="map-hint">Bounded orbit · Click incident in queue or 3D point to focus</div>
      </div>
      <aside className="panel">
        <div className="panel-heading">
          <h2>Incident queue</h2>
          <button onClick={load}>Refresh</button>
        </div>
        {error && <p className="error">{error}</p>}
        {incidents.length === 0 && !error && (
          <p className="empty">No incidents. Call the SiteSignal number to report one.</p>
        )}
        {incidents.map((incident) => {
          const isSelected = incident.id === selectedId;
          const isSecurity = incident.category === "security";
          return (
            <article
              className={`incident ${isSelected ? "selected" : ""}`}
              key={incident.id}
              onClick={() => setSelectedId(incident.id)}
            >
              <div className="incident-top">
                <strong>{incident.id}</strong>
                <span className="status" style={{ color: colorFor(incident.status) }}>
                  {incident.status}
                </span>
              </div>
              <h3>Zone A · {incident.category}</h3>
              <p>{incident.description}</p>
              <small>
                {incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}
              </small>
              {incident.status !== "RESOLVED" && (
                <div className="actions" onClick={(e) => e.stopPropagation()}>
                  {/* Security dispatch button */}
                  {isSecurity && incident.status !== "DISPATCHED_TO_SECURITY" && (
                    <button
                      className="btn-security"
                      onClick={() => updateIncident(incident.id, "dispatch_security")}
                    >
                      🛡️ Отправить охране
                    </button>
                  )}
                  {(incident.status === "REPORTED" || incident.status === "CORROBORATED") && (
                    <button onClick={() => updateIncident(incident.id, "acknowledge")}>
                      Acknowledge
                    </button>
                  )}
                  <button onClick={() => updateIncident(incident.id, "resolve")}>
                    Resolve
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </aside>
    </section>
  </main>;
}

