import * as THREE from 'three';
import { EYE_HEIGHT_M, type PlayerBody } from '../engine/player';

export interface View {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

const FIELD_OF_VIEW_DEG = 70;
const FAR_PLANE_M = 1200;
/** Drawing a laptop screen at 2× costs four times the pixels for little visible gain on flat-shaded geometry. */
const MAX_PIXEL_RATIO = 1.5;

export function createView(canvas: HTMLCanvasElement): View {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEG, 1, 0.1, FAR_PLANE_M);
  camera.rotation.order = 'YXZ';
  const view = { renderer, scene, camera };
  resizeView(view);
  return view;
}

export function resizeView(view: View): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
}

/**
 * Puts the eyes of the player at eye height, plus the head bob of the stride, looking
 * along yaw and pitch (radians).
 */
export function placeCamera(
  camera: THREE.PerspectiveCamera,
  body: PlayerBody,
  yaw: number,
  pitch: number,
  bobM: number,
): void {
  camera.position.set(body.x, body.y + EYE_HEIGHT_M + bobM, body.z);
  camera.rotation.set(pitch, yaw, 0);
}
