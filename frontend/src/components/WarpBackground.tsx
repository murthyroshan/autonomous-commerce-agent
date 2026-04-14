'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PointMaterial, Points } from '@react-three/drei'
import * as THREE from 'three'

function Stars({ isWarping }: { isWarping: boolean }) {
  const ref = useRef<THREE.Points>(null)
  
  // Create 5000 random points in a sphere
  const [positions] = useState(() => {
    const array = new Float32Array(5000 * 3)
    for (let i = 0; i < 5000; i++) {
      // spread uniformly in radius 1.5
      const r = 1.5 * Math.cbrt(Math.random())
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)
      array[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      array[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      array[i * 3 + 2] = r * Math.cos(phi)
    }
    return array
  })

  // We mutate the target speed heavily if warping
  const targetSpeed = useRef(0.02)
  
  useFrame((state, delta) => {
    if (!ref.current) return
    
    // Smoothly interpolate warp speed
    const currentWarp = isWarping ? 2.5 : 0.05
    targetSpeed.current = THREE.MathUtils.lerp(targetSpeed.current, currentWarp, delta * 2)

    // Spin whole group dynamically
    ref.current.rotation.x -= delta / 10
    ref.current.rotation.y -= delta / 15

    // Simulate zooming by expanding position scale slightly (cheap volumetric warp)
    if (isWarping) {
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, 0.5, delta)
    } else {
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, 0, delta)
    }
  })

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={positions} stride={3} frustumCulled={false} depthWrite={false}>
        <PointMaterial
          transparent
          color="#a78bfa"
          size={0.003}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  )
}

export function WarpBackground({ isWarping = false }: { isWarping?: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] bg-[#030303]">
      <Canvas camera={{ position: [0, 0, 1] }} dpr={[1, 1.5]}>
        <Stars isWarping={isWarping} />
      </Canvas>
    </div>
  )
}
