'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

/**
 * AnimatedLogo — Three.js mesh that uses useFrame().
 * Extracted to its own file so Navbar.tsx can dynamically import it
 * (with ssr:false), keeping Three.js out of the initial server bundle.
 */
function AnimatedLogoMesh() {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)

  useFrame((_state, delta) => {
    timeRef.current += delta
    const elapsed = timeRef.current
    if (meshRef.current) {
      meshRef.current.rotation.y = elapsed * 0.4
      meshRef.current.rotation.x = elapsed * 0.2
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * -0.2
      ringRef.current.rotation.x = Math.sin(elapsed * 0.5) * 0.2
    }
  })

  return (
    <Float speed={2.5} rotationIntensity={1.2} floatIntensity={1.5}>
      {/* Core Torus Knot */}
      <mesh ref={meshRef} scale={0.7}>
        <torusKnotGeometry args={[0.8, 0.25, 100, 16]} />
        <meshStandardMaterial
          color="#a78bfa"
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>

      {/* Outer Orbiting Ring */}
      <mesh ref={ringRef} scale={1.2}>
        <torusGeometry args={[1, 0.02, 16, 100]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.4} />
      </mesh>
    </Float>
  )
}

/**
 * Full Canvas wrapper exported as default — this is what the dynamic
 * import in Navbar.tsx resolves to.
 */
export default function NavbarLogoCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} frameloop="always">
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#c4b5fd" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
      <Sparkles count={40} scale={2.5} size={1.5} speed={0.4} opacity={0.5} noise={0.2} color="#a78bfa" />
      <AnimatedLogoMesh />
    </Canvas>
  )
}
