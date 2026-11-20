"use client";

// La salle d'audience en 3D (@react-three/fiber v9 + three). DÉCORATIVE : tout ce qu'elle montre existe aussi en texte dans le
// journal d'audience (§12.4). Formes générées en code (boîtes et cylindres), aucune texture ni police externe.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { EtatSalle, StatutActeur } from "./etat";
import { AMBRE, nomAffiche, OR, PERSONNAGES, type Personnage } from "./personnages";

function Etiquette({ texte, y }: { texte: string; y: number }) {
  const map = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 80;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(20,12,6,0.82)";
    g.beginPath();
    g.roundRect(4, 8, 312, 64, 16);
    g.fill();
    g.fillStyle = "#fff4e0";
    g.font = "bold 34px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(texte, 160, 42);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [texte]);
  return (
    <mesh position={[0, y, 0]}>
      <planeGeometry args={[1.7, 0.425]} />
      <meshBasicMaterial map={map} transparent />
    </mesh>
  );
}

const INTENSITE: Record<StatutActeur, number> = { attente: 0.7, recherche: 1.2, verification: 1.5, vote_scelle: 0.35, parle: 2.6, termine: 0.7, absent: 0 };

function Robot({ p, nom, statut, enveloppe }: { p: Personnage; nom: string; statut: StatutActeur; enveloppe: boolean }) {
  const yeux = useRef<THREE.MeshStandardMaterial[]>([]);
  const groupe = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const base = INTENSITE[statut];
    const pulse = statut === "recherche" ? 0.5 + 0.5 * Math.sin(t * 6) : statut === "parle" ? 0.8 + 0.2 * Math.sin(t * 10) : 1;
    for (const m of yeux.current) if (m) m.emissiveIntensity = base * pulse;
    if (groupe.current) groupe.current.position.y = statut === "parle" ? 0.05 + 0.03 * Math.sin(t * 8) : 0;
  });
  const [x, z] = p.place;
  const rot = Math.atan2(-x, -z);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group ref={groupe}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.75, 0.95, 0.5]} />
          <meshStandardMaterial color={p.couleur} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[0.62, 0.5, 0.5]} />
          <meshStandardMaterial color="#1b1410" roughness={0.4} />
        </mesh>
        {[-0.14, 0.14].map((dx, i) => (
          <mesh key={i} position={[dx, 1.43, 0.26]}>
            <boxGeometry args={[0.1, 0.14, 0.02]} />
            <meshStandardMaterial ref={(m) => { if (m) yeux.current[i] = m; }} color={AMBRE} emissive={AMBRE} emissiveIntensity={0.7} />
          </mesh>
        ))}
        {p.accessoire === "perruque" ? (
          <group position={[0, 1.7, 0]}>
            <mesh scale={[1, 0.62, 0.95]}>
              <sphereGeometry args={[0.38, 20, 14]} />
              <meshStandardMaterial color="#f4efe6" roughness={0.95} />
            </mesh>
            {[-0.36, 0.36].map((dx) => (
              <mesh key={dx} position={[dx, -0.2, 0]}>
                <sphereGeometry args={[0.14, 12, 10]} />
                <meshStandardMaterial color="#f4efe6" roughness={0.95} />
              </mesh>
            ))}
          </group>
        ) : null}
        {p.accessoire === "haut-de-forme" ? (
          <group position={[0, 1.65, 0]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.2, 0.22, 0.4, 20]} />
              <meshStandardMaterial color="#17120f" roughness={0.5} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.36, 0.36, 0.04, 24]} />
              <meshStandardMaterial color="#17120f" roughness={0.5} />
            </mesh>
          </group>
        ) : null}
        {enveloppe ? (
          <mesh position={[0, 0.78, 1.15]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.34, 0.02, 0.24]} />
            <meshStandardMaterial color="#f6efe2" />
          </mesh>
        ) : null}
        {enveloppe ? (
          <mesh position={[0, 0.8, 1.15]}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
            <meshStandardMaterial color="#b3261e" />
          </mesh>
        ) : null}
      </group>
      <group rotation={[0, -rot, 0]} position={[0, 0, 0]}>
        <Etiquette texte={nom} y={2.25} />
      </group>
    </group>
  );
}

function PileDePieces({ verdict }: { verdict: "GO" | "PIVOT" | "NO-GO" | "AJOURNE" | null }) {
  const g = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = clock.getElapsedTime() * 0.35;
    const cible = verdict === "GO" ? 2.2 : verdict === "NO-GO" ? 0.02 : 0.45;
    for (const m of mats.current) if (m) m.emissiveIntensity += (cible - m.emissiveIntensity) * 0.05;
  });
  return (
    <group ref={g} position={[0, 0.8, 0]}>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 2.1) * 0.05, i * 0.07, Math.cos(i * 1.7) * 0.05]} rotation={[0, i * 0.4, 0]}>
          <cylinderGeometry args={[0.5 - (i % 3) * 0.04, 0.5 - (i % 3) * 0.04, 0.06, 28]} />
          <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m; }} color={OR} emissive={OR} emissiveIntensity={0.45} metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Cadrage() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(0, 3.0, 6.3);
    camera.lookAt(0, 0.85, -0.2);
  }, [camera]);
  return null;
}

export default function Scene3D({ etat }: { etat: EtatSalle }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 60 }} gl={{ antialias: true }} aria-hidden="true">
      <color attach="background" args={["#120c08"]} />
      <fog attach="fog" args={["#120c08", 9, 18]} />
      <Cadrage />
      <ambientLight intensity={0.55} color="#ffe2bd" />
      <pointLight position={[0, 4, 0]} intensity={70} color="#ffb45a" decay={2} />
      <directionalLight position={[3, 5, 6]} intensity={0.7} color="#ffd9a8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#241710" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[1.65, 1.65, 0.12, 48]} />
        <meshStandardMaterial color="#4a2f1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.28, 0.5, 0.64, 20]} />
        <meshStandardMaterial color="#35200f" roughness={0.7} />
      </mesh>
      <PileDePieces verdict={etat.verdict?.verdict ?? null} />
      {PERSONNAGES.map((p) => {
        const a = etat.acteurs[p.acteur];
        return <Robot key={p.acteur} p={p} nom={nomAffiche(p, etat.prenomCliente)} statut={a.statut} enveloppe={a.vote1 === "scellee" || a.vote2 === "scellee"} />;
      })}
    </Canvas>
  );
}
