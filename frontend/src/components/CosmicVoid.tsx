"use client";
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ParticleField({ count = 2500 }) {
  const points = useRef<THREE.Points>(null!);
  
  // Base positions for particles to return to after repulsion
  const basePositions = useMemo(() => new Float32Array(count * 3), [count]);
  
  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spread them across a wide plane
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 15;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
    }
    return positions;
  }, [count, basePositions]);

  // Object pooling for performance inside useFrame
  const dummy = useMemo(() => new THREE.Vector3(), []);
  const mouseVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!points.current) return;
    
    // Convert normalized mouse coordinates (-1 to +1) to 3D world space loosely matching our Z plane
    mouseVec.set(
      (state.mouse.x * state.viewport.width) / 2,
      (state.mouse.y * state.viewport.height) / 2,
      0
    );

    const positions = points.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const baseX = basePositions[ix];
      const baseY = basePositions[ix + 1];
      const baseZ = basePositions[ix + 2];

      dummy.set(positions[ix], positions[ix + 1], positions[ix + 2]);

      // 1. Fluid Ripples ("Baby Water Waves")
      // Calculate distance from center to create a continuous radial wave
      const distFromCenter = Math.sqrt(baseX * baseX + baseY * baseY);
      // The wave affects the Z depth
      const waveZ = baseZ + Math.sin(distFromCenter * 0.4 - time * 2) * 0.6;

      // 2. Cursor Repulsion (Igloo/Lusion style)
      const distToMouse = dummy.distanceTo(mouseVec);
      const repelRadius = 4.0;
      
      let targetX = baseX;
      let targetY = baseY;
      let targetZ = waveZ;

      if (distToMouse < repelRadius) {
        // Calculate force based on how close the mouse is (closer = stronger push)
        const force = Math.pow((repelRadius - distToMouse) / repelRadius, 2);
        const dirX = dummy.x - mouseVec.x;
        const dirY = dummy.y - mouseVec.y;
        
        // Normalize the push direction
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len > 0.001) {
          targetX = baseX + (dirX / len) * force * 3.5;
          targetY = baseY + (dirY / len) * force * 3.5;
          // Also push them backward on the Z axis away from the screen
          targetZ = waveZ - force * 4.0;
        }
      }

      // 3. Apply Spring Physics
      // Smoothly interpolate current position towards target position
      positions[ix] += (targetX - positions[ix]) * 0.08;
      positions[ix + 1] += (targetY - positions[ix + 1]) * 0.08;
      positions[ix + 2] += (targetZ - positions[ix + 2]) * 0.08;
    }

    points.current.geometry.attributes.position.needsUpdate = true;
    
    // Very subtle entire-field rotation
    points.current.rotation.y = Math.sin(time * 0.05) * 0.05;
    points.current.rotation.x = Math.cos(time * 0.05) * 0.05;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesPosition.length / 3}
          array={particlesPosition}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#FFFFFF"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export const CosmicVoid: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <ParticleField count={3000} />
      </Canvas>
    </div>
  );
};

export default CosmicVoid;
