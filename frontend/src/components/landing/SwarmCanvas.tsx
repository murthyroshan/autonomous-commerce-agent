'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Line, Environment } from '@react-three/drei';
import * as THREE from 'three';

function AgentNode({ position, color, label }: { position: [number, number, number], color: string, label: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.4, 32, 32]} position={position}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
    </Sphere>
  );
}

function SwarmLines() {
  const points = useMemo(() => [
    new THREE.Vector3(-3, 0, 0), // Search
    new THREE.Vector3(0, 1, -2), // Compare
    new THREE.Vector3(3, 0, 0),  // Decision
  ], []);

  return (
    <Line
      points={points}
      color="cyan"
      lineWidth={1}
      opacity={0.3}
      transparent
    />
  );
}

function SwarmScene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {/* Search Agent */}
      <AgentNode position={[-3, 0, 0]} color="#00bcd4" label="Search" />
      
      {/* Compare Agent */}
      <AgentNode position={[0, 1, -2]} color="#ff9800" label="Compare" />
      
      {/* Decision Agent */}
      <AgentNode position={[3, 0, 0]} color="#4caf50" label="Decision" />

      <SwarmLines />
    </>
  );
}

export function SwarmCanvas() {
  return (
    <div className="absolute inset-0 z-[-1] pointer-events-none opacity-60">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <fog attach="fog" args={['#000', 5, 15]} />
        <Environment preset="city" />
        <SwarmScene />
      </Canvas>
    </div>
  );
}
