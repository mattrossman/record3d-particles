import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GPUComputationRenderer } from 'three-stdlib'

import * as THREE from 'three'
import { remap } from './lib.glsl'
import { computePosition } from './computeShaders.glsl'

const WIDTH = 248

const ParticleShader = {
  uniforms: {
    texturePosition: { value: null },
  },
  vertexShader: /* glsl */ `
    #define SCALE 0.07

    uniform sampler2D texturePosition;

    void main() {
      vec4 posTexel = texture2D( texturePosition, uv );
      vec3 dir = normalize(posTexel.xyz);
      float lifetime = posTexel.w;
      vec3 pos = dir * lifetime;

      vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
      gl_PointSize = SCALE * ( 300.0 / - mvPosition.z ) * (1. - lifetime);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    ${remap}

    void main() {
      vec2 coord = gl_PointCoord - vec2( 0.5 );
      float len = length( coord );
      if ( len > 0.5 ) discard;
      gl_FragColor = vec4(vec3(remap(len, 0.0, 0.5, 1.0, 0.0)), 1.0);
    }
  `,
}

export function Particles({ count = 1000 }) {
  const { gl } = useThree()
  const { gpuCompute, positionVariable } = useMemo(() => {
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, gl)
    const dtPosition = gpuCompute.createTexture()

    // Fill textures
    const positionArray = dtPosition.image.data
    for (let i = 0; i < positionArray.length; i += 4) {
      positionArray[i + 0] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 1] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 2] = THREE.MathUtils.randFloatSpread(2)
      positionArray[i + 3] = Math.random() * 2 // Lifetime
    }

    // Configure GPGPU
    const positionVariable = gpuCompute.addVariable('texturePosition', computePosition, dtPosition)
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable])
    positionVariable.material.uniforms.delta = { value: 0 }

    const error = gpuCompute.init()

    if (error !== null) {
      console.error(error)
    }

    return { gpuCompute, positionVariable }
  }, [gl])

  // Initialize point attributes
  const geometry = useRef()
  useLayoutEffect(() => {
    // position
    const position = new THREE.BufferAttribute(new Float32Array(WIDTH * WIDTH * 3), 3)
    geometry.current.setAttribute('position', position)

    // uv
    const uvArray = []
    for (let j = 0; j < WIDTH; j++) {
      for (let i = 0; i < WIDTH; i++) {
        const u = i / (WIDTH - 1)
        const v = j / (WIDTH - 1)
        uvArray.push(u, v)
      }
    }
    const uv = new THREE.BufferAttribute(new Float32Array(uvArray), 2)
    geometry.current.setAttribute('uv', uv)
  }, [count])

  /** @type {React.RefObject<THREE.ShaderMaterial>} */
  const material = useRef()
  useFrame((_, delta) => {
    positionVariable.material.uniforms.delta.value = delta
    gpuCompute.compute()
    material.current.uniforms['texturePosition'].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture
  })

  return (
    <points>
      <bufferGeometry ref={geometry} />
      <shaderMaterial ref={material} args={[ParticleShader]} />
    </points>
  )
}
