import { useMemo } from 'react'
import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { suspend } from 'suspend-react'
import * as THREE from 'three'

import { Particles } from './Particles'
import { OfflineVideoSource } from './OfflineVideoSource'

export default function App() {
  return (
    <Canvas linear flat camera={{ position: [0, 0, 1] }}>
      <Suspense fallback={null}>
        <OrbitControls />
        <Record3D src="/rgbd.mp4" />
        <Environment preset="night" background />
      </Suspense>
    </Canvas>
  )
}

/**
 * @typedef Record3DProps
 * @property {string} src
 *
 * @param {Record3DProps}
 */
function Record3D({ src }) {
  const { video, intrMat, videoResolution } = suspend(async () => {
    const response = await fetch(src)
    const blob = await response.blob()
    const videoSource = new OfflineVideoSource()
    const { video, intrMat, videoResolution } = await videoSource.load(blob)
    return { video, intrMat, videoResolution }
  }, [src])
  const videoTexture = useMemo(() => {
    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.format = THREE.RGBAFormat // Performance fix for Firefox
    return videoTexture
  }, [video])
  return <Particles map={videoTexture} videoResolution={videoResolution} intrMat={intrMat} />
}
