import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { GPUComputationRenderer } from 'three-stdlib'

import * as THREE from 'three'

const computePosition = /* glsl */ `
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 prevPosition = texture2D( texturePosition, uv );

    gl_FragColor = prevPosition;
  }
`

const ParticleShader = {
  vertexShader: /* glsl */ `
    #define SCALE 0.05
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_PointSize = SCALE * ( 300.0 / - mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    void main() {
      vec2 coord = gl_PointCoord - vec2( 0.5 );
      float len = length( coord );
      if ( len > 0.5 ) discard;
    }
  `,
}

export function Particles({ count = 1000 }) {
  const { gl } = useThree()
  const { gpuCompute } = useMemo(() => {
    const gpuCompute = new GPUComputationRenderer(64, 64, gl)
    const dtPosition = gpuCompute.createTexture()

    // Fill textures
    const positionArray = dtPosition.image.data
    for (let i = 0; i < positionArray.length; i += 4) {
      positionArray[i + 0] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 1] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 2] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 3] = 1
    }

    // Configure GPGPU
    const positionVariable = gpuCompute.addVariable('texturePosition', computePosition, dtPosition)
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable])

    const error = gpuCompute.init()

    if (error !== null) {
      console.error(error)
    }

    return { gpuCompute, positionArray }
  })

  // Initialize point positions
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
      <shaderMaterial args={[ParticleShader]} />
    </points>
  )
}
