import { useLayoutEffect, useState } from 'react'
import { OrbitControls, useTexture } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
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
  const [videoTexture] = useState(() => {
    const video = document.createElement('video')
    video.autoplay = true
    video.src = '/record3d_goat.mp4'
    video.crossOrigin = 'anonymous'
    video.loop = true
    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.format = THREE.RGBAFormat
    videoTexture.encoding = THREE.sRGBEncoding
    return videoTexture
  })
  return (
    <group>
      <OrbitControls />
      <Particles map={videoTexture} />
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
