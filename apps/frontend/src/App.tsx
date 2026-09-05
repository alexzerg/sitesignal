import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, Float, OrbitControls, Text } from "@react-three/drei";

type Incident = {
  id: string;
  zoneId: string;
  category: string;
  description: string;
  status: string;
  reportCount: number;
  updatedAt: string;
  source?: "PHONE" | "API";
  callUuid?: string;
  locationId?: string;
};

type Vec3 = [number, number, number];

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Detailed locations matching the Hospital Site Map template
const locationAnchors: Record<string, Vec3> = {
  cardiology: [0, 8.5, -1.0],          // Cardiology / Critical Care Tower
  critical_care: [0, 4.0, 1.2],        // Mid-tier Critical Care
  emergency_a_and_e: [-9.5, 2.0, 1.5], // A&E entrance
  emergency_entrance: [-11.0, 1.2, 3.8],// Emergency ambulance bay
  helipad: [-16.0, 0.9, 8.2],
  security_gate: [18.0, 1.0, 0.0],
  pharmacy_cafe: [12.5, 1.0, 5.0],
  main_entrance: [-2.0, 1.2, 5.5],     // Main Hospital Entrance
  breast_center: [-5.8, 2.2, -2.5],    // Breast Center
  clinic_block: [-12.5, 3.2, -2.0],    // Multi-floor Clinic Block
  laboratory: [-15.5, 1.8, -6.5],      // Laboratory building
  mental_health: [-4.5, 1.8, -9.0],    // Mental Health Unit
  general_inpatient: [8.0, 2.4, -4.5], // General Inpatient Wing
  oncology: [12.5, 2.4, 0.5],          // Oncology Building
  dermatology: [16.5, 1.6, 2.3],       // Dermatology Clinic
  neonatal: [5.8, 2.4, 5.0],           // Neonatal Care
  maternity: [5.8, 1.6, 9.0],          // Maternity Unit
  parking_west: [-11.5, 0.5, -8.5],    // West Parking
  parking_central: [4.0, 0.5, -0.5],   // Central Staff Parking
  parking_maternity: [-0.5, 0.5, 8.5]  // South Parking
};

const anchorList = Object.values(locationAnchors);

function colorFor(status?: string) {
  if (status === "AWAITING_CONFIRMATION") return "#22d3ee";
  if (status === "RESOLVED") return "#22c55e";
  if (status === "DISPATCHED_TO_SECURITY") return "#f43f5e";
  if (status === "ACKNOWLEDGED") return "#eab308";
  if (status === "CORROBORATED") return "#f97316";
  if (status === "REPORTED") return "#ef4444";
  return "#64748b";
}

// Blueprint holographic building block with luminous cyan wireframe edges
function BlueprintBuilding({
  args,
  position,
  label,
  floors = 1
}: {
  args: [number, number, number];
  position: Vec3;
  label?: string;
  floors?: number;
}) {
  const [w, h, d] = args;
  const floorHeight = h / floors;
  const floorSlabs = Array.from({ length: floors - 1 }, (_, i) => (i + 1) * floorHeight - h / 2);

  return (
    <group position={position}>
      {/* Outer semi-transparent blueprint glass volume */}
      <mesh>
        <boxGeometry args={args} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.88}
          roughness={0.12}
          metalness={0.1}
          transparent
          opacity={0.32}
          side={2}
        />
        {/* Crisp luminous cyan wireframe edges */}
        <Edges threshold={15} color="#38bdf8" />
      </mesh>

      {/* Internal structural floor wireframe slabs */}
      {floorSlabs.map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <boxGeometry args={[w * 0.98, 0.06, d * 0.98]} />
          <meshBasicMaterial color="#0369a1" transparent opacity={0.55} />
          <Edges threshold={15} color="#0ea5e9" />
        </mesh>
      ))}

      {/* Building holographic label */}
      {label && (
        <group position={[0, h / 2 + 0.55, 0]}>
          <mesh>
            <planeGeometry args={[Math.min(w * 0.9, 5.5), 0.42]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.8} />
          </mesh>
          <Text fontSize={0.24} color="#7dd3fc" anchorX="center" anchorY="middle">
            {label}
          </Text>
        </group>
      )}
    </group>
  );
}

// Low-poly blueprint holographic car with wireframe
function BlueprintCar({
  position,
  rotation = [0, 0, 0]
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.2, 0.28, 0.65]} />
        <meshBasicMaterial color="#075985" transparent opacity={0.65} />
        <Edges threshold={15} color="#38bdf8" />
      </mesh>
      <mesh position={[-0.05, 0.38, 0]}>
        <boxGeometry args={[0.65, 0.22, 0.58]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.5} />
        <Edges threshold={15} color="#7dd3fc" />
      </mesh>
    </group>
  );
}

// Low-poly blueprint ambulance
function BlueprintAmbulance({
  position,
  rotation = [0, 0, 0]
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.6, 0.65, 0.82]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.75} />
        <Edges threshold={15} color="#38bdf8" />
      </mesh>
      {/* Emergency flashing blue beacon */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.22, 0.1, 0.35]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
    </group>
  );
}

// Holographic wireframe tree
function BlueprintTree({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.9, 6]} />
        <meshBasicMaterial color="#0369a1" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <coneGeometry args={[0.48, 1.1, 6]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.35} />
        <Edges threshold={15} color="#38bdf8" />
      </mesh>
    </group>
  );
}

// Entire Hospital Campus rendered in cinematic cyan/blue architectural wireframe skeleton
function HospitalCampus() {
  const floorLevels = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <group position={[0, 0, 0]}>
      {/* Base ground plate - Dark blueprint slate grid (46 x 34) */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[46, 0.2, 34]} />
        <meshStandardMaterial color="#030b17" roughness={0.9} />
        <Edges threshold={15} color="#0369a1" />
      </mesh>

      {/* Road / circulation layout in dark slate with blueprint edges */}
      <mesh position={[0, -0.04, -13.5]}>
        <boxGeometry args={[45, 0.02, 3.0]} />
        <meshBasicMaterial color="#07182e" transparent opacity={0.8} />
        <Edges threshold={15} color="#0284c7" />
      </mesh>
      <mesh position={[0, -0.04, 13.5]}>
        <boxGeometry args={[45, 0.02, 3.0]} />
        <meshBasicMaterial color="#07182e" transparent opacity={0.8} />
        <Edges threshold={15} color="#0284c7" />
      </mesh>
      <mesh position={[-7.5, -0.04, 0]}>
        <boxGeometry args={[2.5, 0.02, 25]} />
        <meshBasicMaterial color="#07182e" transparent opacity={0.8} />
        <Edges threshold={15} color="#0284c7" />
      </mesh>
      <mesh position={[9.0, -0.04, 0]}>
        <boxGeometry args={[2.5, 0.02, 25]} />
        <meshBasicMaterial color="#07182e" transparent opacity={0.8} />
        <Edges threshold={15} color="#0284c7" />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[30, 0.02, 2.4]} />
        <meshBasicMaterial color="#07182e" transparent opacity={0.8} />
        <Edges threshold={15} color="#0284c7" />
      </mesh>

      {/* ========================================================
          1. CENTRAL MAIN TOWER (Cardiology Center / Critical Care)
          8-floor high-rise glass wireframe skeleton with visible interior slabs
         ======================================================== */}
      <group position={[0, 0, -1.0]}>
        {/* Transparent outer glass facade with cyan Edges */}
        <mesh position={[0, 4.8, 0]}>
          <boxGeometry args={[9.5, 9.6, 6.8]} />
          <meshPhysicalMaterial
            color="#0284c7"
            transmission={0.92}
            roughness={0.05}
            transparent
            opacity={0.22}
            side={2}
          />
          <Edges threshold={15} color="#38bdf8" />
        </mesh>

        {/* Visible interior floor slabs (F1..F8) */}
        {floorLevels.map((lvl) => {
          const y = lvl * 1.15 + 0.6;
          return (
            <group key={lvl} position={[0, y, 0]}>
              <mesh>
                <boxGeometry args={[9.2, 0.06, 6.5]} />
                <meshBasicMaterial color="#075985" transparent opacity={0.55} />
                <Edges threshold={15} color="#0ea5e9" />
              </mesh>
              {/* Central elevator / core shaft */}
              <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[2.8, 0.95, 2.2]} />
                <meshBasicMaterial color="#0369a1" transparent opacity={0.45} />
                <Edges threshold={15} color="#38bdf8" />
              </mesh>
              <Text position={[-4.7, 0.22, 3.3]} fontSize={0.24} color="#7dd3fc" anchorX="center">
                F{lvl + 1}
              </Text>
            </group>
          );
        })}

        {/* Stepped front tier: Critical Care */}
        <mesh position={[0, 2.5, 3.8]}>
          <boxGeometry args={[7.8, 4.8, 2.8]} />
          <meshPhysicalMaterial
            color="#0369a1"
            transmission={0.85}
            roughness={0.1}
            transparent
            opacity={0.28}
            side={2}
          />
          <Edges threshold={15} color="#38bdf8" />
        </mesh>

        {/* Cardiology center sign attached to upper facade */}
        <group position={[0, 9.2, 3.42]}>
          <mesh>
            <planeGeometry args={[5.2, 0.55]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.85} />
            <Edges threshold={15} color="#38bdf8" />
          </mesh>
          <Text fontSize={0.26} color="#38bdf8" anchorX="center" anchorY="middle">
            CARDIOLOGY CENTER
          </Text>
        </group>
        <group position={[0, 4.6, 5.22]}>
          <mesh>
            <planeGeometry args={[4.2, 0.45]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.85} />
            <Edges threshold={15} color="#38bdf8" />
          </mesh>
          <Text fontSize={0.22} color="#7dd3fc" anchorX="center" anchorY="middle">
            CRITICAL CARE
          </Text>
        </group>
      </group>

      {/* ========================================================
          2. A&E (ACCIDENT & EMERGENCY) & AMBULANCE BAY
         ======================================================== */}
      <BlueprintBuilding
        args={[6.8, 2.8, 5.2]}
        position={[-9.5, 1.4, 2.0]}
        label="A&E / EMERGENCY"
        floors={2}
      />
      {/* Covered Ambulance Bay frame */}
      <mesh position={[-10.0, 1.2, 5.4]}>
        <boxGeometry args={[5.2, 0.12, 2.2]} />
        <meshBasicMaterial color="#075985" transparent opacity={0.6} />
        <Edges threshold={15} color="#38bdf8" />
      </mesh>
      {[-12.2, -7.8].map((x) => (
        <mesh key={x} position={[x, 0.6, 6.3]}>
          <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
      <BlueprintAmbulance position={[-11.2, 0, 5.5]} />
      <BlueprintAmbulance position={[-8.8, 0, 5.5]} />

      {/* ========================================================
          3. BREAST CENTER (Connecting wing)
         ======================================================== */}
      <BlueprintBuilding
        args={[4.2, 3.4, 3.5]}
        position={[-5.8, 1.7, -2.5]}
        label="BREAST CENTER"
        floors={3}
      />

      {/* ========================================================
          4. CLINIC BLOCK (5-floor office/consulting building)
         ======================================================== */}
      <BlueprintBuilding
        args={[5.2, 5.6, 4.4]}
        position={[-12.5, 2.8, -2.0]}
        label="CLINIC BLOCK"
        floors={5}
      />

      {/* ========================================================
          5. LABORATORY
         ======================================================== */}
      <BlueprintBuilding
        args={[5.8, 2.6, 3.6]}
        position={[-15.5, 1.3, -6.5]}
        label="LABORATORY"
        floors={2}
      />

      {/* ========================================================
          6. MENTAL HEALTH UNIT (North-West)
         ======================================================== */}
      <BlueprintBuilding
        args={[6.2, 2.4, 3.8]}
        position={[-4.5, 1.2, -9.0]}
        label="MENTAL HEALTH"
        floors={2}
      />

      {/* ========================================================
          7. GENERAL INPATIENT WING (North-East)
         ======================================================== */}
      <BlueprintBuilding
        args={[7.2, 3.6, 4.4]}
        position={[8.0, 1.8, -4.5]}
        label="GENERAL INPATIENT"
        floors={3}
      />

      {/* ========================================================
          8. ONCOLOGY BUILDING & DERMATOLOGY CLINIC (East)
         ======================================================== */}
      <BlueprintBuilding
        args={[5.8, 3.2, 4.2]}
        position={[12.3, 1.6, 0.5]}
        label="ONCOLOGY"
        floors={3}
      />
      <BlueprintBuilding
        args={[3.8, 2.2, 3.2]}
        position={[16.5, 1.1, 2.3]}
        label="DERMATOLOGY"
        floors={2}
      />
      {/* Skybridge wireframe */}
      <mesh position={[8.5, 2.2, -0.5]}>
        <boxGeometry args={[3.2, 1.1, 1.2]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.88}
          transparent
          opacity={0.3}
          side={2}
        />
        <Edges threshold={15} color="#38bdf8" />
      </mesh>

      {/* ========================================================
          9. NEONATAL CARE & MATERNITY WING (South-East)
         ======================================================== */}
      <BlueprintBuilding
        args={[7.2, 3.6, 4.5]}
        position={[5.8, 1.8, 5.0]}
        label="NEONATAL CARE"
        floors={3}
      />
      <BlueprintBuilding
        args={[6.4, 2.4, 3.2]}
        position={[5.8, 1.2, 9.0]}
        label="MATERNITY"
        floors={2}
      />

      {/* ========================================================
          10. PARKING LOTS WITH BLUEPRINT WIREFRAME CARS
         ======================================================== */}
      {/* West Parking lot */}
      <group position={[-11.5, 0.01, -8.5]}>
        <mesh>
          <boxGeometry args={[5.5, 0.03, 4.5]} />
          <meshBasicMaterial color="#071b30" transparent opacity={0.7} />
          <Edges threshold={15} color="#0284c7" />
        </mesh>
        <Text position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color="#38bdf8" anchorX="center">
          P
        </Text>
        <BlueprintCar position={[-1.8, 0.03, -1.2]} rotation={[0, Math.PI / 2, 0]} />
        <BlueprintCar position={[-0.5, 0.03, -1.2]} rotation={[0, Math.PI / 2, 0]} />
        <BlueprintCar position={[0.8, 0.03, -1.2]} rotation={[0, Math.PI / 2, 0]} />
        <BlueprintCar position={[2.0, 0.03, -1.2]} rotation={[0, Math.PI / 2, 0]} />
      </group>

      {/* Central Staff Parking */}
      <group position={[4.0, 0.01, -0.5]}>
        <mesh>
          <boxGeometry args={[4.8, 0.03, 3.2]} />
          <meshBasicMaterial color="#071b30" transparent opacity={0.7} />
          <Edges threshold={15} color="#0284c7" />
        </mesh>
        <Text position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.65} color="#38bdf8" anchorX="center">
          P
        </Text>
        <BlueprintCar position={[-1.2, 0.03, 0.8]} />
        <BlueprintCar position={[0.4, 0.03, 0.8]} />
        <BlueprintAmbulance position={[-0.4, 0.03, -0.7]} rotation={[0, Math.PI, 0]} />
      </group>

      {/* South Maternity Parking */}
      <group position={[-0.5, 0.01, 8.5]}>
        <mesh>
          <boxGeometry args={[5.8, 0.03, 3.2]} />
          <meshBasicMaterial color="#071b30" transparent opacity={0.7} />
          <Edges threshold={15} color="#0284c7" />
        </mesh>
        <Text position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.65} color="#38bdf8" anchorX="center">
          P
        </Text>
        <BlueprintCar position={[-2.0, 0.03, 0.4]} />
        <BlueprintCar position={[-0.8, 0.03, 0.4]} />
        <BlueprintCar position={[0.4, 0.03, 0.4]} />
        <BlueprintCar position={[1.6, 0.03, 0.4]} />
      </group>

      {/* Architectural perimeter trees in blueprint wireframe */}
      {[-18, -15, -12, -9, 0, 3, 7, 12, 16, 19].map((x) => (
        <group key={x}>
          <BlueprintTree position={[x, 0, -11.8]} />
          <BlueprintTree position={[x, 0, 12.0]} />
        </group>
      ))}
      {[-8, -5, -2, 2, 5, 8].map((z) => (
        <group key={z}>
          <BlueprintTree position={[-19.5, 0, z]} />
          <BlueprintTree position={[20.5, 0, z]} />
        </group>
      ))}
    </group>
  );
}

// 3D Pin / Beacon Marker for an incident (retains triage color for priority)
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

  return (
    <Float speed={2.8} rotationIntensity={0.15} floatIntensity={0.5} position={position}>
      <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {/* Pulsing ground highlight ring */}
        <mesh position={[0, -position[1] + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, isSelected ? 1.8 : 1.3, 32]} />
          <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.9 : 0.5} side={2} />
        </mesh>

        {/* Vertical beacon beam */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.65} />
        </mesh>

        {/* 3D Location Pin Head (Cone pointing down + Sphere) */}
        <group position={[0, 2.5, 0]} scale={isSelected ? 1.4 : 1.0}>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.55, 24, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isSelected ? 1.4 : 0.9}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, -0.15, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.55, 0.9, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isSelected ? 1.4 : 0.9}
            />
          </mesh>

          {/* Incident ID Tag */}
          <group position={[0, 1.15, 0]}>
            <mesh>
              <boxGeometry args={[1.8, 0.5, 0.08]} />
              <meshStandardMaterial color="#020617" />
              <Edges threshold={15} color={color} />
            </mesh>
            <Text position={[0, 0, 0.05]} fontSize={0.28} color={color} anchorX="center" anchorY="middle">
              {incident.id}
            </Text>
          </group>
        </group>
      </group>
    </Float>
  );
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
  let offset = 0;
  const markers = incidents.map((incident) => {
    const desc = incident.description.toLowerCase();
    let pos: Vec3 = anchorList[offset++ % anchorList.length];
    if (incident.locationId && locationAnchors[incident.locationId]) {
      pos = locationAnchors[incident.locationId];
    } else if (desc.includes("emergency") || desc.includes("a&e") || desc.includes("patient")) {
      pos = locationAnchors.emergency_entrance;
    } else if (desc.includes("cardio") || desc.includes("heart")) {
      pos = locationAnchors.cardiology;
    } else if (desc.includes("security") || desc.includes("guard")) {
      pos = locationAnchors.main_entrance;
    } else if (desc.includes("parking") || desc.includes("car")) {
      pos = locationAnchors.parking_central;
    } else if (desc.includes("lab")) {
      pos = locationAnchors.laboratory;
    } else if (desc.includes("mental")) {
      pos = locationAnchors.mental_health;
    }

    return { incident, position: pos };
  });

  return (
    <Canvas shadows camera={{ position: [32, 28, 38], fov: 45 }}>
      {/* Deep cinematic blueprint background with light blue fog */}
      <color attach="background" args={["#020817"]} />
      <fog attach="fog" args={["#020817", 45, 110]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[20, 35, 25]} intensity={3.5} color="#e0f2fe" castShadow />
      <directionalLight position={[-20, 20, -15]} intensity={2.0} color="#38bdf8" />
      <pointLight position={[0, 18, 0]} color="#38bdf8" intensity={30} distance={55} />

      {/* Cyber/blueprint cyan floor grid */}
      <gridHelper args={[60, 60, "#0284c7", "#072b4f"]} position={[0, -0.22, 0]} />

      <group>
        <HospitalCampus />
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

      {/* Clamped Orbit: no view below ground, bounded rotation keeping isometric view */}
      <OrbitControls
        enablePan
        enableRotate
        enableZoom
        enableDamping
        rotateSpeed={0.7}
        zoomSpeed={0.85}
        dampingFactor={0.08}
        minPolarAngle={0.25}
        maxPolarAngle={1.42}
        minAzimuthAngle={-Math.PI / 2.2}
        maxAzimuthAngle={Math.PI / 2.2}
        minDistance={20}
        maxDistance={95}
        target={[0, 2.0, 0]}
      />
    </Canvas>
  );
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

  async function deleteIncident(id: string) {
    await fetch(`${API}/api/incidents/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(undefined);
    await load();
  }

  async function createDemoIncident() {
    await fetch(`${API}/api/incidents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        zoneId: "zone-a",
        category: "security",
        description: "Aggressive patient in Zone A near Emergency Bay",
        zoneCode: "123",
        confirmed: true
      })
    });
    await load();
  }

  async function clearAll() {
    if (!confirm("Очистить все тестовые инциденты?")) return;
    await fetch(`${API}/api/incidents`, { method: "DELETE" });
    setSelectedId(undefined);
    await load();
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const activeCount = incidents.filter((i) => !["RESOLVED", "REJECTED", "DUPLICATE", "EXPIRED"].includes(i.status)).length;

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p>
          <h1>Voice-powered incident reporting</h1>
          <p className="subtitle">
            Holographic Architectural Blueprint · Cardiology tower, A&E, Maternity, Oncology, Clinic Block & Emergency bays.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={createDemoIncident}
            style={{ fontSize: "12px", background: "#0369a1", color: "#f0f9ff", borderColor: "#38bdf8" }}
          >
            + Test Incident
          </button>
          {incidents.length > 0 && (
            <button onClick={clearAll} style={{ fontSize: "12px", background: "#334155", color: "#cbd5e1" }}>
              Clear Data
            </button>
          )}
          <span className="pill">{activeCount} active signals</span>
        </div>
      </header>
      <section className="layout">
        <div className="map-card">
          <SpatialMap
            incidents={incidents}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
          <div className="map-hint">
            Holographic Campus Blueprint · Click 3D Pin or Queue item to inspect
          </div>
        </div>
        <aside className="panel">
          <div className="panel-heading">
            <h2>Incident queue</h2>
            <button onClick={load}>Refresh</button>
          </div>
          {error && <p className="error">{error}</p>}
          {incidents.length === 0 && !error && (
            <div className="empty">
              <p>No active incidents.</p>
              <button
                onClick={createDemoIncident}
                style={{ marginTop: "12px", fontSize: "12px", background: "#0369a1", color: "#f0f9ff", borderColor: "#38bdf8" }}
              >
                Create sample incident
              </button>
            </div>
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
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span className="status" style={{ color: colorFor(incident.status) }}>
                      {incident.status}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteIncident(incident.id); }}
                      style={{ padding: "2px 6px", fontSize: "11px", background: "transparent", borderColor: "#475569" }}
                      title="Удалить тестовый инцидент"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <h3>Zone A · {incident.category}</h3>
                {incident.status === "AWAITING_CONFIRMATION" && (
                  <div className="call-awaiting">☎ Incoming call · waiting for location code / caller confirmation</div>
                )}
                <p>{incident.description}</p>
                <small>
                  {incident.source === "PHONE" ? "☎ PHONE" : "API"} · {incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}
                </small>
                {incident.status !== "RESOLVED" && incident.status !== "REJECTED" && incident.status !== "AWAITING_CONFIRMATION" && (
                  <div className="actions" onClick={(e) => e.stopPropagation()}>
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
    </main>
  );
}
