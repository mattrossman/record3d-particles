import React, { useLayoutEffect, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer'

import * as THREE from 'three'
import { remap } from './lib.glsl'
import { computeColor, computeLifecycle, computePosition, computeVelocity } from './computeShaders.glsl'
import { useControls } from 'leva'

const WIDTH = 256
const COUNT = WIDTH * WIDTH

const ParticleShader = {
  uniforms: {
    texturePosition: { value: null },
    textureVelocity: { value: null },
    textureColor: { value: null },
    textureLifecycle: { value: null },
    particleSize: { value: 0.1 },
  },
  vertexShader: /* glsl */ `
    #define SCALE 0.07

    uniform sampler2D texturePosition;
    uniform sampler2D textureVelocity;
    uniform sampler2D textureLifecycle;
    uniform float particleSize;

    varying vec2 vUv;

    void main() {
      // Read buffers
      vec4 texelPosition = texture2D( texturePosition, uv );
      vec4 texelVelocity = texture2D( textureVelocity, uv );
      vec4 texelLifecycle = texture2D( textureLifecycle, uv );

      // Parse buffers
      vec3 pos = texelPosition.xyz;
      float age = texelLifecycle.x;
      float maxAge = texelLifecycle.y;
      bool respawn = bool(texelLifecycle.z);

      float decay = (maxAge - age) / maxAge;

      vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
      // [DEBUG]
      // gl_PointSize = particleSize * decay * ( 300.0 / - mvPosition.z );
      gl_PointSize = particleSize * ( 300.0 / - mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;

      // Clip particles that are respawning
      if (respawn) {
        gl_Position.x = gl_Position.z * 2.;
      }
      
      // Prepare varyings for fragment shader
      vUv = uv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D textureColor;
    uniform sampler2D textureLifecycle;

    varying vec2 vUv;

    ${remap}

    void main() {
      // Read buffers
      vec4 texelColor = texture2D(textureColor, vUv);
      vec4 texelLifecycle = texture2D( textureLifecycle, vUv );

      // Parse buffers
      vec3 initialColor = texelColor.xyz;
      float age = texelLifecycle.x;
      
      vec2 coord = gl_PointCoord - vec2( 0.5 );
      float len = length( coord );
      if ( len > 0.5 ) discard;
      float brightness = remap(len, 0.0, 0.5, 1.0, 0.0);
      float fadeIn = smoothstep(0., 0.2, age);
      // [DEBUG]
      gl_FragColor = vec4(initialColor * brightness * fadeIn, 1.0);
      // gl_FragColor = vec4(initialColor, 1.0);
    }
  `,
}

/**
 * @typedef ParticlesProps
 * @property {THREE.Texture} map
 *
 * @param {ParticlesProps}
 */
export function Particles({ map = null, videoResolution = [], intrMat = null }) {
  const { gl } = useThree()
  const { gpuCompute, uniforms, variablePosition, variableVelocity, variableColor, variableLifecycle } = useMemo(() => {
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, gl)
    const dtPosition = gpuCompute.createTexture()
    const dtVelocity = gpuCompute.createTexture()
    const dtColor = gpuCompute.createTexture()
    const dtLifecycle = gpuCompute.createTexture()

    // Flag all particles for respawn
    const arrayLifecycle = dtLifecycle.image.data
    for (let i = 0; i < arrayLifecycle.length; i += 4) {
      arrayLifecycle[i + 0] = 0 // age
      arrayLifecycle[i + 1] = 0 // maxAge
      arrayLifecycle[i + 2] = 1 // respawn
      arrayLifecycle[i + 3] = 0 // (ignored)
    }

    // Configure GPGPU
    const variablePosition = gpuCompute.addVariable('texturePosition', computePosition, dtPosition)
    const variableVelocity = gpuCompute.addVariable('textureVelocity', computeVelocity, dtVelocity)
    const variableColor = gpuCompute.addVariable('textureColor', computeColor, dtColor)
    const variableLifecycle = gpuCompute.addVariable('textureLifecycle', computeLifecycle, dtLifecycle)
    gpuCompute.setVariableDependencies(variablePosition, [variableLifecycle, variablePosition, variableVelocity])
    gpuCompute.setVariableDependencies(variableVelocity, [variableLifecycle, variablePosition, variableVelocity])
    gpuCompute.setVariableDependencies(variableColor, [variableLifecycle, variablePosition, variableColor])
    gpuCompute.setVariableDependencies(variableLifecycle, [variableLifecycle, variablePosition])

    // Shared uniforms
    const uniforms = {
      delta: { value: 0 },
      time: { value: 0 },
      map: { value: map },
      videoResolution: { value: new THREE.Vector2() },
      iK: { value: new THREE.Vector4() },
      range: { value: new THREE.Vector2() },
      filterRadius: { value: 1 },
      filterThreshold: { value: 1 },
    }
    Object.assign(variablePosition.material.uniforms, uniforms)
    Object.assign(variableVelocity.material.uniforms, uniforms)
    Object.assign(variableLifecycle.material.uniforms, uniforms)
    Object.assign(variableColor.material.uniforms, uniforms)

    const error = gpuCompute.init()

    if (error !== null) {
      console.error(error)
    }

    return { gpuCompute, uniforms, variablePosition, variableVelocity, variableColor, variableLifecycle }
  }, [gl])

  useEffect(() => {
    const ifx = 1.0 / intrMat.elements[0]
    const ify = 1.0 / intrMat.elements[4]
    const itx = -intrMat.elements[2] / intrMat.elements[0]
    const ity = -intrMat.elements[5] / intrMat.elements[4]
    uniforms.iK.value.set(ifx, ify, itx, ity)
    uniforms.videoResolution.value.fromArray(videoResolution)
  }, [videoResolution, intrMat])

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
  }, [])

  /** @type {React.RefObject<THREE.ShaderMaterial>} */
  const material = useRef()
  useFrame(({ clock }, delta) => {
    uniforms.delta.value = delta
    uniforms.time.value = clock.elapsedTime

    gpuCompute.compute()
    material.current.uniforms['texturePosition'].value = gpuCompute.getCurrentRenderTarget(variablePosition).texture
    material.current.uniforms['textureVelocity'].value = gpuCompute.getCurrentRenderTarget(variableVelocity).texture
    material.current.uniforms['textureColor'].value = gpuCompute.getCurrentRenderTarget(variableColor).texture
    material.current.uniforms['textureLifecycle'].value = gpuCompute.getCurrentRenderTarget(variableLifecycle).texture
  })

  const { particleSize } = useControls({
    particleSize: { value: 0.02, min: 0.001, max: 0.04 },
    range: { value: [0.3, 2.8], min: 0, max: 3, onChange: (v) => uniforms.range.value.fromArray(v) },
    filterRadius: { value: 0, min: 0, max: 0.5, onChange: (v) => (uniforms.filterRadius.value = v) },
    filterThreshold: { value: 3, min: 0, max: 3, onChange: (v) => (uniforms.filterThreshold.value = v) },
  })
  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometry} />
      <shaderMaterial
        ref={material}
        args={[ParticleShader]}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        uniforms-particleSize-value={particleSize}
      />
    </points>
  )
}
