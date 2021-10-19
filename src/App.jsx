import { useRef } from 'react'
import { OrbitControls, TorusKnot, useTexture } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Particles } from './Particles'
import { Suspense } from 'react'

export default function App() {
  return (
    <Canvas>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}

function Scene() {
  const texture = useTexture(
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Obama_portrait_crop.jpg/762px-Obama_portrait_crop.jpg'
  )
  return (
    <group>
      <OrbitControls />
      <Particles map={texture} />
    </group>
  )
}

function Obama() {
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
