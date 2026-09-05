"use client";
import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

interface CoreMeshProps {
  isForging?: boolean;
}

function CoreMesh({ isForging = false }: CoreMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Normal rotation + forging acceleration
      const speed = isForging ? 4.0 : 0.5;
      meshRef.current.rotation.x += delta * speed;
      meshRef.current.rotation.y += delta * (speed * 1.4);
    }
    if (innerRef.current) {
      // Inner core pulses
      const scale = isForging
        ? 1.0 + Math.sin(state.clock.elapsedTime * 8) * 0.4
        : 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      innerRef.current.scale.setScalar(scale);
    }
  });

  return (
    <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
      {/* Outer refractive crystal shell */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1.6, 0]} />
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={0.8}
          chromaticAberration={0.3}
          anisotropy={0.2}
          distortion={isForging ? 1.2 : 0.4}
          distortionScale={0.3}
          temporalDistortion={isForging ? 0.5 : 0.1}
          color={isForging ? "#FF4500" : "#A855F7"}
          roughness={0.1}
        />
      </mesh>

      {/* Internal glowing core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial
          color={isForging ? "#FFAA00" : "#00F0FF"}
          toneMapped={false}
        />
      </mesh>

      {/* Energy ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.02, 8, 64]} />
        <meshBasicMaterial
          color="#A855F7"
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
    </Float>
  );
}

interface RelicCore3DProps {
  isForging?: boolean;
}

export const RelicCore3D: React.FC<RelicCore3DProps> = ({ isForging = false }) => {
  return (
    <div className="w-full h-64 md:h-80 relative rounded-2xl overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} color="#FFB800" intensity={2} />
        <pointLight position={[-10, -10, -10]} color="#00F0FF" intensity={2} />
        <pointLight position={[0, -10, 5]} color="#A855F7" intensity={1.5} />

        <CoreMesh isForging={isForging} />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={isForging ? 2.5 : 1.2}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default RelicCore3D;
