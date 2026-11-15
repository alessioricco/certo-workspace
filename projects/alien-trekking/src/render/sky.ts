import * as THREE from 'three';
import type { Rgb } from '../engine/color';
import type { MoonView } from '../engine/moons';
import type { SkyState, Vec3 } from '../engine/sky';
import { starField } from '../engine/stars';

const DOME_RADIUS_M = 1000;
const CELESTIAL_DISTANCE_M = 950;
const STAR_COUNT = 1200;
const STAR_POINT_PX = 2;
const SUN_RADIUS_M = 28;
const SUN_HALO_RADIUS_M = 75;
const SUN_HALO_OPACITY = 0.3;
const SUN_LIGHT_DISTANCE_M = 100;
const SUN_LIGHT_INTENSITY = 2.2;
const AMBIENT_NIGHT = 0.7;
const AMBIENT_DAY = 1.1;
const GROUND_AMBIENT = 0x3a2a24;
const ORIGIN = new THREE.Vector3();

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 zenith;
  uniform vec3 horizon;
  varying vec3 vDirection;
  void main() {
    gl_FragColor = vec4(mix(horizon, zenith, smoothstep(0.0, 0.5, vDirection.y)), 1.0);
    #include <colorspace_fragment>
  }
`;

type Unlit = THREE.MeshBasicMaterial;

function setColour(target: THREE.Color, rgb: Rgb): void {
  target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
}

function placeOnSky(object: THREE.Object3D, direction: Vec3, origin: THREE.Vector3, distance: number): void {
  object.position.set(
    origin.x + direction[0] * distance,
    origin.y + direction[1] * distance,
    origin.z + direction[2] * distance,
  );
}

function starGeometry(seed: number): THREE.BufferGeometry {
  const field = starField(seed, STAR_COUNT);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colours = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = field.directions[i * 3 + axis] * CELESTIAL_DISTANCE_M;
      colours[i * 3 + axis] = field.brightness[i];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** Draws the sky dome, the sun, the stars and the moons, and the light and fog they give. */
export class SkyRenderer {
  private readonly zenith = new THREE.Color();
  private readonly horizon = new THREE.Color();
  private readonly dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS_M, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: { zenith: { value: this.zenith }, horizon: { value: this.horizon } },
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  private readonly sun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(SUN_RADIUS_M, 2),
    new THREE.MeshBasicMaterial({ fog: false }),
  );
  private readonly halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(SUN_HALO_RADIUS_M, 1),
    new THREE.MeshBasicMaterial({
      fog: false,
      transparent: true,
      opacity: SUN_HALO_OPACITY,
      depthWrite: false,
    }),
  );
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly moons: THREE.Mesh<THREE.IcosahedronGeometry, Unlit>[];
  private readonly hemisphere = new THREE.HemisphereLight(0xffffff, GROUND_AMBIENT, AMBIENT_DAY);
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, SUN_LIGHT_INTENSITY);
  private readonly fog = new THREE.FogExp2(0x000000, 0);

  constructor(scene: THREE.Scene, seed: number, moonCount: number) {
    this.dome.renderOrder = -1;
    this.stars = new THREE.Points(
      starGeometry(seed),
      new THREE.PointsMaterial({
        size: STAR_POINT_PX,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        fog: false,
        depthWrite: false,
      }),
    );
    this.moons = Array.from(
      { length: moonCount },
      () => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ fog: false })),
    );
    scene.add(
      this.dome,
      this.sun,
      this.halo,
      this.stars,
      this.hemisphere,
      this.sunLight,
      ...this.moons,
    );
    scene.fog = this.fog;
  }

  update(state: SkyState, moons: MoonView[], camera: THREE.Vector3): void {
    this.dome.position.copy(camera);
    setColour(this.zenith, state.zenithColour);
    setColour(this.horizon, state.horizonColour);
    setColour(this.fog.color, state.horizonColour);
    this.fog.density = state.fogDensityPerM;

    const starAbove = state.starDirection[1] > 0;
    this.sun.visible = starAbove;
    this.halo.visible = starAbove;
    placeOnSky(this.sun, state.starDirection, camera, CELESTIAL_DISTANCE_M);
    placeOnSky(this.halo, state.starDirection, camera, CELESTIAL_DISTANCE_M);
    setColour(this.sun.material.color, state.starColour);
    setColour(this.halo.material.color, state.starColour);

    placeOnSky(this.sunLight, state.starDirection, ORIGIN, SUN_LIGHT_DISTANCE_M);
    setColour(this.sunLight.color, state.starColour);
    this.sunLight.intensity = SUN_LIGHT_INTENSITY * state.daylight;
    setColour(this.hemisphere.color, state.ambientColour);
    this.hemisphere.intensity = AMBIENT_NIGHT + (AMBIENT_DAY - AMBIENT_NIGHT) * state.daylight;

    this.stars.position.copy(camera);
    this.stars.material.opacity = 1 - state.daylight;
    this.stars.geometry.setDrawRange(0, Math.round(STAR_COUNT * state.visibleStarFraction));

    this.moons.forEach((mesh, index) => {
      const view = moons[index];
      mesh.visible = view.direction[1] > 0;
      placeOnSky(mesh, view.direction, camera, CELESTIAL_DISTANCE_M);
      mesh.scale.setScalar(CELESTIAL_DISTANCE_M * Math.tan((view.angularRadiusDeg * Math.PI) / 180));
      setColour(mesh.material.color, view.colour);
    });
  }
}
