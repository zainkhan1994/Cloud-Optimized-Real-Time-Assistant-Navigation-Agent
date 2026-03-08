/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
  varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform float time;
uniform vec4 inputData;
uniform vec4 outputData;
uniform float speakIntensity;
uniform float listenIntensity;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;

vec3 calc( vec3 pos, vec3 nor ) {
  vec3 dir = normalize(nor);
  
  // Displacement based on audio
  float disp = 0.0;
  disp += 0.2 * inputData.x * sin(pos.x * 10.0 + time * 5.0);
  disp += 0.2 * outputData.x * sin(pos.y * 10.0 + time * 5.0);
  
  // Neural ripple effect when listening
  disp += 0.1 * listenIntensity * sin(length(pos) * 20.0 - time * 10.0);
  
  return pos + dir * disp;
}

void main() {
  vUv = uv;
  vPos = position;
  #include <uv_vertex>
  #include <color_vertex>
  #include <morphinstance_vertex>
  #include <morphcolor_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <normal_vertex>
  #include <begin_vertex>

  vec3 np = calc( position, normal );

  vNormal = normalize( normalMatrix * normal );
  transformed = np;

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
  #ifdef USE_TRANSMISSION
    vWorldPosition = worldPosition.xyz;
  #endif
}
`;

const fs = `
uniform float time;
uniform float speakIntensity;
uniform float listenIntensity;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPos;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0)); // Simple view dir
  float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
  
  // Base holographic blue
  vec3 color = vec3(0.1, 0.4, 1.0);
  
  // Neural code pattern (scrolling lines)
  float lines = step(0.95, fract(vUv.y * 50.0 + time * 2.0));
  lines *= step(0.8, fract(vUv.x * 10.0 - time * 0.5));
  color += vec3(0.5, 0.8, 1.0) * lines * 0.5;
  
  // Glowing edges
  color += vec3(0.2, 0.6, 1.0) * fresnel * 2.0;
  
  // Interaction highlights
  color += vec3(0.8, 0.9, 1.0) * speakIntensity * (0.5 + 0.5 * sin(time * 20.0));
  color += vec3(0.5, 1.0, 0.8) * listenIntensity * (0.5 + 0.5 * cos(time * 15.0));
  
  float alpha = 0.7 + 0.3 * fresnel + 0.2 * lines;
  
  gl_FragColor = vec4(color, alpha);
}
`;

export {vs, fs};
