'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Create a much larger plane geometry to stretch into the distance
  const geometry = useMemo(() => new THREE.PlaneGeometry(100, 100, 30, 30), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#000000',
    emissive: '#a855f7', // Brighter Purple
    emissiveIntensity: 0.5,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  }), [])

  // Store original Z positions
  const originalZ = useMemo(() => {
    const arr = new Float32Array(geometry.attributes.position.count)
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      arr[i] = geometry.attributes.position.getZ(i)
    }
    return arr
  }, [geometry])
  
  // Track continuous time without using deprecated THREE.Clock
  const timeRef = useRef(0)
  
  useFrame((state, delta) => {
    if (!meshRef.current) return
    timeRef.current += delta
    const time = timeRef.current
    
    const positionAttribute = geometry.attributes.position
    // Modify Z vertex positions based on sine noise
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i)
        const y = positionAttribute.getY(i)
        
        // Balanced wave calculation for massive ocean
        const z = originalZ[i] 
            + Math.sin(x * 0.1 + time * 0.3) * 1.5
            + Math.sin((x + y) * 0.15 + time * 0.5) * 0.5
            
        positionAttribute.setZ(i, z)
    }
    positionAttribute.needsUpdate = true
    
    // Removed the physical Y position jump since the math creates infinite scrolling!
  })

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material} 
      rotation={[-Math.PI / 2.2, 0, 0]} 
      position={[0, -3, -10]} 
    />
  )
}

export function TerrainBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[0] bg-[#050505] overflow-hidden">
      <Canvas camera={{ position: [0, 2, 5], fov: 60 }} dpr={[1, 1.5]}>
        <fog attach="fog" args={['#050505', 5, 40]} />
        <Terrain />
      </Canvas>
    </div>
  )
}
