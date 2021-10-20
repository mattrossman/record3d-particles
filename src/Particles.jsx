import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer'

import * as THREE from 'three'
import { remap } from './lib.glsl'
import { computeColor, computePosition, computeVelocity } from './computeShaders.glsl'
import { useControls } from 'leva'

const WIDTH = 256
const COUNT = WIDTH * WIDTH

const ParticleShader = {
  uniforms: {
    texturePosition: { value: null },
    textureVelocity: { value: null },
    textureColor: { value: null },
    particleSize: { value: 0.1 },
  },
  vertexShader: /* glsl */ `
    #define SCALE 0.07

    uniform sampler2D texturePosition;
    uniform sampler2D textureVelocity;
    uniform float particleSize;

    varying vec2 vUv;

    void main() {
      vUv = uv;

      vec4 texelPosition = texture2D( texturePosition, uv );
      vec4 texelVelocity = texture2D( textureVelocity, uv );
      vec3 pos = texelPosition.xyz;
      float age = texelPosition.w;
      float respawn = texelVelocity.w;

      float decay = (2.0 - age) / 2.0;

      vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
      gl_PointSize = particleSize * decay * ( 300.0 / - mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;

      // Clip particles that are respawning
      if (respawn == 1.0) {
        gl_Position.x = gl_Position.z * 2.;
      }
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D textureColor;
    uniform sampler2D texturePosition;

    varying vec2 vUv;

    ${remap}

    void main() {
      vec4 texelColor = texture2D(textureColor, vUv);
      vec4 texelPosition = texture2D(texturePosition, vUv);
      float age = texelPosition.w;
      
      vec2 coord = gl_PointCoord - vec2( 0.5 );
      float len = length( coord );
      if ( len > 0.5 ) discard;
      float brightness = remap(len, 0.0, 0.5, 1.0, 0.0);
      float fadeIn = smoothstep(0., 0.2, age);
      gl_FragColor = vec4(texelColor.rgb * brightness * fadeIn, 1.0);
    }
  `,
}

/**
 * @typedef ParticlesProps
 * @property {THREE.Texture} map
 *
 * @param {ParticlesProps}
 */
export function Particles({ map = null }) {
  const { gl } = useThree()
  const { gpuCompute, positionVariable, velocityVariable, colorVariable } = useMemo(() => {
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, gl)
    const dtPosition = gpuCompute.createTexture()
    const dtVelocity = gpuCompute.createTexture()
    const dtColor = gpuCompute.createTexture()

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
    const velocityVariable = gpuCompute.addVariable('textureVelocity', computeVelocity, dtVelocity)
    const colorVariable = gpuCompute.addVariable('textureColor', computeColor, dtColor)
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable])
    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable])
    gpuCompute.setVariableDependencies(colorVariable, [positionVariable, colorVariable])
    positionVariable.material.uniforms = {
      delta: { value: 0 },
      time: { value: 0 },
    }
    velocityVariable.material.uniforms.delta = { value: 0 }
    colorVariable.material.uniforms.map = { value: map }

    const error = gpuCompute.init()

    if (error !== null) {
      console.error(error)
    }

    return { gpuCompute, positionVariable, velocityVariable, colorVariable }
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

    // lifetime
    const lifetimeArray = Array(COUNT)
      .fill()
      .map(() => THREE.MathUtils.randFloat(1, 2))
    const lifetime = new THREE.BufferAttribute(new Float32Array(lifetimeArray), 1)
    geometry.current.setAttribute('lifetime', lifetime)
  }, [])

  /** @type {React.RefObject<THREE.ShaderMaterial>} */
  const material = useRef()
  useFrame(({ clock }, delta) => {
    positionVariable.material.uniforms.delta.value = velocityVariable.material.uniforms.delta.value = delta
    positionVariable.material.uniforms.time.value = clock.elapsedTime
    gpuCompute.compute()
    material.current.uniforms['texturePosition'].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture
    material.current.uniforms['textureVelocity'].value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture
    material.current.uniforms['textureColor'].value = gpuCompute.getCurrentRenderTarget(colorVariable).texture
  })

  const { size } = useControls({ size: { value: 0.1, min: 0.01, max: 0.2 } })
  return (
    <points>
      <bufferGeometry ref={geometry} />
      <shaderMaterial
        ref={material}
        args={[ParticleShader]}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        uniforms-particleSize-value={size}
      />
    </points>
  )
}
