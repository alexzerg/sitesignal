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

type Vec3 = [number, number, number];

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Detailed locations matching the Hospital Site Map template
const locationAnchors: Record<string, Vec3> = {
  cardiology: [0, 8.5, -1.0],      // Top of Cardiology / Critical Care Tower
  critical_care: [0, 4.0, 1.2],    // Mid-tier Critical Care
  emergency_a_and_e: [-8.5, 2.0, 1.5], // A&E entrance
  emergency_entrance: [-11.0, 1.2, 3.8], // Emergency ambulance bay
  main_entrance: [-2.0, 1.2, 5.5], // Main Hospital Entrance
  breast_center: [-6.5, 3.0, -1.8], // Breast Center
  clinic_block: [-12.5, 3.2, -1.0], // Multi-floor Clinic Block
  laboratory: [-15.5, 1.8, -4.5],  // Laboratory building
  mental_health: [-4.0, 2.0, -8.5],// Mental Health Unit
  general_inpatient: [7.5, 2.8, -4.5], // General Inpatient Wing
  oncology: [12.0, 2.6, 0.5],      // Oncology Building
  dermatology: [15.0, 1.8, 3.2],   // Dermatology Clinic
  neonatal: [4.8, 2.8, 5.0],       // Neonatal Care
  maternity: [5.2, 1.8, 8.8],      // Maternity Unit
  parking_west: [-12.0, 0.5, -7.0],// West Parking
  parking_east: [11.0, 0.5, 7.8],  // East Parking
  parking_central: [4.0, 0.5, -0.5]// Central Staff Parking
};

const anchorList = Object.values(locationAnchors);

function colorFor(status?: string) {
  if (status === "RESOLVED") return "#22c55e";
  if (status === "DISPATCHED_TO_SECURITY") return "#f43f5e";
  if (status === "ACKNOWLEDGED") return "#eab308";
  if (status === "CORROBORATED") return "#f97316";
  if (status === "REPORTED") return "#ef4444";
  return "#64748b";
}

// Window matrix component for realistic hospital facades
function WindowGrid({
  width,
  height,
  rows,
  cols,
  position,
  rotation = [0, 0, 0]
}: {
  width: number;
  height: number;
  rows: number;
  cols: number;
  position: Vec3;
  rotation?: Vec3;
}) {
  const cellW = width / cols;
  const cellH = height / rows;
  const items: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push({
        x: (c - (cols - 1) / 2) * cellW,
        y: (r - (rows - 1) / 2) * cellH
      });
    }
  }

  return (
    <group position={position} rotation={rotation}>
      {items.map((it, idx) => (
        <mesh key={idx} position={[it.x, it.y, 0.02]}>
          <planeGeometry args={[cellW * 0.72, cellH * 0.65]} />
          <meshStandardMaterial color="#0284c7" roughness={0.1} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Red directional entrance arrow / flag marker matching template
function EntranceMarker({
  text,
  position,
  rotation = [0, 0, 0]
}: {
  text: string;
  position: Vec3;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Red flag pole */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Red badge */}
      <mesh position={[0.7, 0.85, 0]}>
        <boxGeometry args={[1.5, 0.45, 0.08]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <Text position={[0.7, 0.85, 0.06]} fontSize={0.16} color="white" anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
}

// Ambulance vehicle model
function Ambulance({ position, rotation = [0, 0, 0] }: { position: Vec3; rotation?: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.6, 0.7, 0.85]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0.4, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.82]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {/* Blue emergency beacon */}
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.4]} />
        <meshStandardMaterial color="#2563eb" emissive="#3b82f6" emissiveIntensity={1.2} />
      </mesh>
      {/* Red cross stripe */}
      <mesh position={[-0.2, 0.4, 0.43]}>
        <boxGeometry args={[0.6, 0.12, 0.02]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* Wheels */}
      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.12, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.08, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[x, 0.12, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.08, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Low-poly parked car
function Car({ position, color, rotation = [0, 0, 0] }: { position: Vec3; color: string; rotation?: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[1.2, 0.32, 0.65]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.05, 0.42, 0]}>
        <boxGeometry args={[0.65, 0.26, 0.58]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} />
      </mesh>
      {/* Wheels */}
      {[-0.38, 0.38].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.1, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[x, 0.1, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Tree model
function CampusTree({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.55, 10, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#16a34a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Complete Hospital Campus based on the isometric template
function HospitalCampus() {
  const floorLevels = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <group position={[0, 0, 0]}>
      {/* Lush green campus terrain matching template (46 x 34) */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[46, 0.3, 34]} />
        <meshStandardMaterial color="#4d7c0f" roughness={0.9} />
      </mesh>

      {/* Road network - Light grey tarmac running through and around the campus */}
      {/* Main horizontal perimeter road */}
      <mesh position={[0, -0.04, -13.5]}>
        <boxGeometry args={[45, 0.04, 3.0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {/* South entrance road */}
      <mesh position={[0, -0.04, 13.5]}>
        <boxGeometry args={[45, 0.04, 3.0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {/* Central campus internal driveways */}
      <mesh position={[-7.5, -0.04, 0]}>
        <boxGeometry args={[2.5, 0.04, 25]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
      <mesh position={[9.0, -0.04, 0]}>
        <boxGeometry args={[2.5, 0.04, 25]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[30, 0.04, 2.4]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>

      {/* ========================================================
          1. CENTRAL MAIN TOWER (Cardiology Center / Critical Care)
          High-rise glass tower with visible internal floor slabs
         ======================================================== */}
      <group position={[0, 0, -1.0]}>
        {/* Transparent outer glass facade */}
        <mesh position={[0, 4.8, 0]}>
          <boxGeometry args={[9.5, 9.6, 6.8]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transmission={0.88}
            roughness={0.05}
            transparent
            opacity={0.28}
            side={2}
          />
        </mesh>
        {/* Visible interior floor slabs */}
        {floorLevels.map((lvl) => {
          const y = lvl * 1.15 + 0.6;
          return (
            <group key={lvl} position={[0, y, 0]}>
              <mesh>
                <boxGeometry args={[9.2, 0.12, 6.5]} />
                <meshStandardMaterial color="#e0f2fe" roughness={0.5} transparent opacity={0.85} />
              </mesh>
              {/* Internal medical core and elevator banks */}
              <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[3.2, 0.9, 2.4]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.65} />
              </mesh>
              <Text position={[-4.8, 0.2, 3.3]} fontSize={0.28} color="#0369a1" anchorX="center">
                F{lvl + 1}
              </Text>
            </group>
          );
        })}
        {/* Concrete mechanical penthouse and roof signage */}
        <mesh position={[0, 9.8, 0]}>
          <boxGeometry args={[7.5, 0.6, 5.0]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <Text position={[0, 10.2, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.65} color="#0f172a" anchorX="center">
          Cardiology center
        </Text>
        {/* Stepped front tier: Critical Care */}
        <mesh position={[0, 2.5, 3.8]}>
          <boxGeometry args={[7.8, 4.8, 2.8]} />
          <meshStandardMaterial color="#bae6fd" roughness={0.2} transparent opacity={0.8} />
        </mesh>
        <WindowGrid width={7.0} height={4.0} rows={4} cols={8} position={[0, 2.5, 5.25]} />
        <Text position={[0, 5.05, 3.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.48} color="#0369a1" anchorX="center">
          Critical care
        </Text>
      </group>

      {/* ========================================================
          2. A&E (ACCIDENT & EMERGENCY) & AMBULANCE BAY
         ======================================================== */}
      <group position={[-9.5, 0, 2.0]}>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[6.8, 2.8, 5.2]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
        </mesh>
        {/* Red emergency stripe */}
        <mesh position={[0, 2.7, 0]}>
          <boxGeometry args={[6.9, 0.25, 5.3]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <WindowGrid width={6.0} height={1.8} rows={2} cols={6} position={[0, 1.4, 2.62]} />
        <Text position={[0, 2.95, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.68} color="#dc2626" anchorX="center">
          A&E
        </Text>
        {/* Covered Emergency Ambulance Bay */}
        <mesh position={[-0.5, 1.2, 3.6]}>
          <boxGeometry args={[5.2, 0.2, 2.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* Support pillars */}
        {[-2.8, 1.8].map((x) => (
          <mesh key={x} position={[x, 0.6, 4.5]}>
            <cylinderGeometry args={[0.08, 0.08, 1.2, 8]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        ))}
        {/* Parked Ambulances */}
        <Ambulance position={[-1.6, 0, 3.8]} rotation={[0, 0, 0]} />
        <Ambulance position={[0.8, 0, 3.8]} rotation={[0, 0, 0]} />
      </group>

      {/* ========================================================
          3. BREAST CENTER (Connecting wing)
         ======================================================== */}
      <group position={[-5.8, 0, -2.5]}>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[4.2, 3.4, 3.5]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </mesh>
        <WindowGrid width={3.8} height={2.5} rows={3} cols={4} position={[0, 1.8, 1.77]} />
        <Text position={[0, 3.6, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.42} color="#0f172a" anchorX="center">
          Breast center
        </Text>
      </group>

      {/* ========================================================
          4. CLINIC BLOCK (5-floor office/consulting building)
         ======================================================== */}
      <group position={[-12.5, 0, -2.0]}>
        <mesh position={[0, 2.8, 0]}>
          <boxGeometry args={[5.2, 5.6, 4.4]} />
          <meshStandardMaterial color="#e0f2fe" roughness={0.3} />
        </mesh>
        <WindowGrid width={4.6} height={4.8} rows={5} cols={5} position={[0, 2.8, 2.22]} />
        <Text position={[0, 5.75, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#0369a1" anchorX="center">
          Clinic block
        </Text>
      </group>

      {/* ========================================================
          5. LABORATORY
         ======================================================== */}
      <group position={[-15.5, 0, -6.5]}>
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[5.8, 2.6, 3.6]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
        </mesh>
        <WindowGrid width={5.2} height={1.8} rows={2} cols={5} position={[0, 1.3, 1.82]} />
        <Text position={[0, 2.7, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.42} color="#1e293b" anchorX="center">
          Laboratory
        </Text>
      </group>

      {/* ========================================================
          6. MENTAL HEALTH UNIT (North-West)
         ======================================================== */}
      <group position={[-4.5, 0, -9.0]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[6.2, 2.4, 3.8]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
        </mesh>
        <WindowGrid width={5.6} height={1.6} rows={2} cols={6} position={[0, 1.2, 1.92]} />
        <Text position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#0f766e" anchorX="center">
          Mental Health unit
        </Text>
      </group>

      {/* ========================================================
          7. GENERAL INPATIENT WING (North-East)
         ======================================================== */}
      <group position={[8.0, 0, -4.5]}>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[7.2, 3.6, 4.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <WindowGrid width={6.5} height={2.8} rows={3} cols={7} position={[0, 1.8, 2.22]} />
        <Text position={[0, 3.7, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.48} color="#0369a1" anchorX="center">
          General inpatient
        </Text>
      </group>

      {/* ========================================================
          8. ONCOLOGY BUILDING & DERMATOLOGY CLINIC (East)
         ======================================================== */}
      <group position={[13.5, 0, 0.5]}>
        {/* Oncology Building */}
        <mesh position={[-1.2, 1.6, 0]}>
          <boxGeometry args={[5.8, 3.2, 4.2]} />
          <meshStandardMaterial color="#e0f2fe" roughness={0.3} />
        </mesh>
        <WindowGrid width={5.2} height={2.4} rows={3} cols={5} position={[-1.2, 1.6, 2.12]} />
        <Text position={[-1.2, 3.3, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.44} color="#0369a1" anchorX="center">
          Oncology building
        </Text>

        {/* Dermatology Clinic adjoining wing */}
        <mesh position={[3.2, 1.1, 1.8]}>
          <boxGeometry args={[3.8, 2.2, 3.2]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </mesh>
        <WindowGrid width={3.2} height={1.5} rows={2} cols={3} position={[3.2, 1.1, 3.42]} />
        <Text position={[3.2, 2.3, 1.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.38} color="#334155" anchorX="center">
          Dermatology clinic
        </Text>

        {/* Elevated glass skybridge connecting back to main hospital */}
        <mesh position={[-5.0, 2.2, -1.0]}>
          <boxGeometry args={[3.5, 1.1, 1.2]} />
          <meshPhysicalMaterial color="#93c5fd" transmission={0.8} transparent opacity={0.4} />
        </mesh>
      </group>

      {/* ========================================================
          9. NEONATAL CARE & MATERNITY WING (South-East)
         ======================================================== */}
      <group position={[5.8, 0, 6.5]}>
        {/* Neonatal Care */}
        <mesh position={[0, 1.8, -1.5]}>
          <boxGeometry args={[7.2, 3.6, 4.5]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <WindowGrid width={6.5} height={2.8} rows={3} cols={6} position={[0, 1.8, 0.77]} />
        <Text position={[0, 3.7, -1.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.48} color="#0f766e" anchorX="center">
          Neonatal care
        </Text>

        {/* Maternity Unit */}
        <mesh position={[0, 1.2, 2.6]}>
          <boxGeometry args={[6.4, 2.4, 3.2]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </mesh>
        <WindowGrid width={5.8} height={1.6} rows={2} cols={5} position={[0, 1.2, 4.22]} />
        <Text position={[0, 2.5, 2.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.48} color="#0369a1" anchorX="center">
          Maternity
        </Text>
      </group>

      {/* ========================================================
          10. PARKING LOTS WITH INDIVIDUAL VEHICLES
         ======================================================== */}
      {/* West Parking lot */}
      <group position={[-11.5, 0.01, -8.5]}>
        <mesh>
          <boxGeometry args={[5.5, 0.05, 4.5]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.9} color="#60a5fa" anchorX="center">
          P
        </Text>
        <Car position={[-1.8, 0.04, -1.2]} color="#ef4444" rotation={[0, Math.PI / 2, 0]} />
        <Car position={[-0.5, 0.04, -1.2]} color="#f8fafc" rotation={[0, Math.PI / 2, 0]} />
        <Car position={[0.8, 0.04, -1.2]} color="#0284c7" rotation={[0, Math.PI / 2, 0]} />
        <Car position={[2.0, 0.04, -1.2]} color="#eab308" rotation={[0, Math.PI / 2, 0]} />
      </group>

      {/* Central Visitor Parking */}
      <group position={[4.0, 0.01, -0.5]}>
        <mesh>
          <boxGeometry args={[4.8, 0.05, 3.2]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.8} color="#60a5fa" anchorX="center">
          P
        </Text>
        <Car position={[-1.2, 0.04, 0.8]} color="#f8fafc" />
        <Car position={[0.4, 0.04, 0.8]} color="#0f172a" />
        <Ambulance position={[-0.4, 0.04, -0.7]} rotation={[0, Math.PI, 0]} />
      </group>

      {/* South Maternity Parking */}
      <group position={[-0.5, 0.01, 8.5]}>
        <mesh>
          <boxGeometry args={[5.8, 0.05, 3.2]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.8} color="#60a5fa" anchorX="center">
          P
        </Text>
        <Car position={[-2.0, 0.04, 0.4]} color="#dc2626" />
        <Car position={[-0.8, 0.04, 0.4]} color="#f8fafc" />
        <Car position={[0.4, 0.04, 0.4]} color="#38bdf8" />
        <Car position={[1.6, 0.04, 0.4]} color="#e2e8f0" />
      </group>

      {/* East Oncology Parking */}
      <group position={[11.5, 0.01, 8.0]}>
        <mesh>
          <boxGeometry args={[4.8, 0.05, 3.2]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.8} color="#60a5fa" anchorX="center">
          P
        </Text>
        <Car position={[-1.2, 0.04, 0.4]} color="#0f172a" />
        <Car position={[0.2, 0.04, 0.4]} color="#f59e0b" />
        <Car position={[1.5, 0.04, 0.4]} color="#f8fafc" />
      </group>

      {/* ========================================================
          11. RED DIRECTIONAL ENTRANCE SIGNS (from template)
         ======================================================== */}
      <EntranceMarker text="Emergency entrance" position={[-13.5, 0, 5.5]} rotation={[0, 0.35, 0]} />
      <EntranceMarker text="Main entrance" position={[-4.5, 0, 7.8]} rotation={[0, -0.2, 0]} />
      <EntranceMarker text="West entrance" position={[-17.0, 0, -10.5]} rotation={[0, 0.8, 0]} />
      <EntranceMarker text="North entrance" position={[10.5, 0, -11.5]} rotation={[0, -0.4, 0]} />
      <EntranceMarker text="East entrance" position={[16.5, 0, 11.5]} rotation={[0, -0.8, 0]} />

      {/* Landscaping Trees along roads & courtyards */}
      {[-18, -15, -12, -9, 0, 3, 7, 12, 16, 19].map((x) => (
        <group key={x}>
          <CampusTree position={[x, 0, -11.8]} />
          <CampusTree position={[x, 0, 12.0]} />
        </group>
      ))}
      {[-8, -5, -2, 2, 5, 8].map((z) => (
        <group key={z}>
          <CampusTree position={[-19.5, 0, z]} />
          <CampusTree position={[20.5, 0, z]} />
        </group>
      ))}
    </group>
  );
}

// 3D Pin / Beacon Marker for an incident
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
          <ringGeometry args={[0.8, isSelected ? 1.6 : 1.2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.8 : 0.45} side={2} />
        </mesh>

        {/* Vertical beacon beam */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
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
    // Map incident to one of the canonical hospital zones
    const desc = incident.description.toLowerCase();
    let pos: Vec3 = anchorList[offset++ % anchorList.length];
    if (desc.includes("emergency") || desc.includes("a&e") || desc.includes("patient")) {
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
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[20, 35, 25]} intensity={4.2} castShadow />
      <directionalLight position={[-20, 20, -15]} intensity={1.8} color="#93c5fd" />
      <pointLight position={[0, 18, 0]} color="#f8fafc" intensity={25} distance={50} />

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

  const activeCount = incidents.filter((i) => i.status !== "RESOLVED").length;

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">SITESIGNAL / LIVE OPERATIONS</p>
          <h1>Voice-powered incident reporting</h1>
          <p className="subtitle">
            Hospital Site Map: Multi-story Cardiology & Critical Care tower, A&E, Maternity, Oncology, Clinic Block & Emergency bays.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {incidents.length > 0 && (
            <button onClick={clearAll} style={{ fontSize: "12px", background: "#334155", color: "#cbd5e1" }}>
              Clear Test Data
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
            Interactive Hospital Campus · Click 3D Pin or Queue item to inspect
          </div>
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
                <p>{incident.description}</p>
                <small>
                  {incident.reportCount} report(s) · {new Date(incident.updatedAt).toLocaleTimeString()}
                </small>
                {incident.status !== "RESOLVED" && (
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


