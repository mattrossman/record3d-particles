import { useLayoutEffect, useRef } from 'react'
import { OrbitControls, TorusKnot, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Particles } from './Particles'
import { Suspense } from 'react'
import * as THREE from 'three'

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
      <Background />
    </group>
  )
}

function Background({ color = 'black' }) {
  const { set } = useThree()
  useLayoutEffect(() => {
    set(({ scene }) => void (scene.background = new THREE.Color(color)))
  }, [color])
  return null
}

function Obama() {
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
