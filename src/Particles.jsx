import { GPUComputationRenderer } from 'three-stdlib'
import * as THREE from 'three'
import { forwardRef, useLayoutEffect, useRef } from 'react'

export function Particles({ count = 1000 }) {
  const geometry = useRef()
  useLayoutEffect(() => {
    const positionArray = Array(count * 3)
      .fill()
      .map(() => THREE.MathUtils.randFloatSpread(2))
    const position = new THREE.BufferAttribute(new Float32Array(positionArray), 3)
    geometry.current.setAttribute('position', position)
  }, [count])
  return (
    <points>
      <bufferGeometry ref={geometry} />
      <pointsMaterial size={0.1} color="red" />
    </points>
  )
}
