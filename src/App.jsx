import { useLayoutEffect, useMemo, useEffect } from 'react'
import { OrbitControls, Plane, useTexture } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Particles } from './Particles'
import { Suspense } from 'react'
import * as THREE from 'three'
import { OfflineVideoSource } from './OfflineVideoSource'
import { suspend } from 'suspend-react'
import { MeshBasicMaterial } from 'three'

export default function App() {
  const onDrop = (e) => {
    e.preventDefault()
    const mp4File = e.dataTransfer.files[0]
    console.log(mp4File)
  }
  const preventDefault = (e) => e.preventDefault()
  return (
    <>
      <Canvas linear flat camera={{ position: [0, 0, 1] }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      {/* <div style={{ position: 'absolute', inset: 0, background: 'gray' }} onDrop={onDrop} onDragOver={preventDefault}>
        Drag n drop
      </div> */}
    </>
  )
}

function Scene() {
  const { video, intrMat } = suspend(async () => {
    const response = await fetch('/record3d_goat.mp4')
    const blob = await response.blob()
    const videoSource = new OfflineVideoSource()
    const { video, intrMat } = await videoSource.load(blob)
    return { video, intrMat }
  }, [])
  const videoTexture = useMemo(() => {
    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.format = THREE.RGBAFormat
    return videoTexture
  }, [video])
  return (
    <group>
      <OrbitControls />
      <Particles map={videoTexture} videoResolution={[video.videoWidth, video.videoWidth]} intrMat={intrMat} />
      <Background />
      <axesHelper />
      {/* <Plane>
        <meshBasicMaterial map={videoTexture} />
      </Plane> */}
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
