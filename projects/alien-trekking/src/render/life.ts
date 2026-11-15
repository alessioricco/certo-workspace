import * as THREE from 'three';
import type { AnimalSpecies } from '../engine/animals';
import { chunkKey, type ChunkCoord } from '../engine/chunks';
import { herdsInChunk, plantsInChunk, predatorsInChunk, type Ecosystem } from '../engine/ecosystem';
import { animalScanPoint, stepHerd, type Animal, type Herd, type Mood, type Observer } from '../engine/herds';
import type { Caller } from '../engine/soundscape';
import { stepPredators, type Predator, type PredatorEvent, type PredatorMood } from '../engine/predators';
import type { SpeciesInfo } from '../engine/species';
import { findAimedTarget, type ScanTarget } from '../engine/scanner';
import type { Vec3 } from '../engine/sky';
import { terrainSurfaceHeight } from '../engine/terrain';
import type { BuildBudget } from './budget';
import {
  animalShape,
  neckPoint,
  plantChunkGeometry,
  plantTemplate,
  territoryMarkGeometry,
  type AnimalShape,
  type PlacedMark,
} from './lifeMeshes';

const GRAZE_HEAD_RAD = 0.9;
const WARN_HEAD_RAD = -0.6;
const ATTACK_HEAD_RAD = 0.5;
const STUN_LEAN_RAD = 0.6;

type Creature = Animal | Predator;

interface CreatureView<T extends Creature> {
  creature: T;
  species: AnimalSpecies;
  group: THREE.Group;
  neck: THREE.Object3D;
  target: ScanTarget;
}

interface HerdView {
  herd: Herd;
  animals: CreatureView<Animal>[];
}

interface LifeChunk {
  /** The chunk's plants, models and territory marks, which stay in place. */
  root: THREE.Group;
  bounds: THREE.Box3;
  plants?: THREE.Mesh;
  plantModels: THREE.Object3D[];
  marks?: THREE.Mesh;
  plantTargets: ScanTarget[];
  herds: HerdView[];
  predators: CreatureView<Predator>[];
}

interface AnimalKind {
  species: AnimalSpecies;
  shape: AnimalShape;
}

/** Draws the plants, animals and predators of the chunks the terrain has loaded, and moves the animals. */
export class LifeRenderer {
  private readonly chunks = new Map<string, LifeChunk>();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  });
  private readonly plantTemplates: Map<string, THREE.BufferGeometry>;
  private readonly animalKinds: Map<string, AnimalKind>;
  private readonly species = new Map<string, SpeciesInfo>();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();

  /** `models` are the level's animal models by species id; a modelled animal is shown as its model. */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly ecosystem: Ecosystem,
    private readonly models: ReadonlyMap<string, THREE.Object3D> = new Map(),
  ) {
    this.plantTemplates = new Map(
      ecosystem.plants.map((plant) => [plant.id, plantTemplate(plant)]),
    );
    const animals = [...ecosystem.animals, ...ecosystem.predators];
    this.animalKinds = new Map(
      animals.map((species) => [species.id, { species, shape: animalShape(species) }]),
    );
    for (const species of [...ecosystem.plants, ...animals]) {
      this.species.set(species.id, species);
    }
  }

  /**
   * Streams the chunks, moves the herds and predators, and returns the predators' warnings and strikes.
   * `loaded` are the chunks with detailed ground; life is only built on those.
   */
  update(
    loaded: readonly ChunkCoord[],
    observer: Observer,
    dtS: number,
    budget: BuildBudget,
    simulate = true,
  ): PredatorEvent[] {
    const wanted = new Set(loaded.map(chunkKey));
    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) this.remove(key, chunk);
    }
    for (const coord of loaded) {
      if (this.chunks.has(chunkKey(coord))) continue;
      if (!budget.tryStart()) break;
      this.add(coord);
    }

    const heightAt = (x: number, z: number): number => terrainSurfaceHeight(x, z, this.ecosystem.seed);
    const events: PredatorEvent[] = [];
    for (const chunk of this.chunks.values()) {
      for (const view of chunk.herds) {
        if (simulate) stepHerd(view.herd, observer, dtS, heightAt);
        for (const member of view.animals) this.place(member, heightAt);
      }
      if (simulate) events.push(...stepPredators(chunk.predators.map((view) => view.creature), observer, dtS, heightAt));
      for (const member of chunk.predators) this.place(member, heightAt);
    }
    return events;
  }

  /** Hides the static life of each chunk whose bounds lie outside the view, so its models are not drawn. */
  cull(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    for (const chunk of this.chunks.values()) {
      chunk.root.visible = !chunk.bounds.isEmpty() && this.frustum.intersectsBox(chunk.bounds);
    }
  }

  /** Every animal and predator that can make a call, with its position and size. */
  callers(): Caller[] {
    const callers: Caller[] = [];
    for (const chunk of this.chunks.values()) {
      for (const view of chunk.herds) {
        for (const member of view.animals) callers.push(this.callerOf(member));
      }
      for (const predator of chunk.predators) callers.push(this.callerOf(predator));
    }
    return callers;
  }

  /** The plant or animal at the centre of the view, if any is in scanning range. */
  aimTarget(eye: Vec3, forward: Vec3): ScanTarget | undefined {
    return findAimedTarget(eye, forward, this.targets());
  }

  /** The species of the plant or animal at the centre of the view, if any is in scanning range. */
  aim(eye: Vec3, forward: Vec3): SpeciesInfo | undefined {
    const target = this.aimTarget(eye, forward);
    return target && this.speciesOf(target.speciesId);
  }

  speciesOf(speciesId: string): SpeciesInfo {
    const species = this.species.get(speciesId);
    if (!species) throw new Error(`No species ${speciesId}`);
    return species;
  }

  private *targets(): Generator<ScanTarget> {
    for (const chunk of this.chunks.values()) {
      yield* chunk.plantTargets;
      for (const view of chunk.herds) {
        for (const member of view.animals) yield member.target;
      }
      for (const predator of chunk.predators) yield predator.target;
    }
  }

  private add(coord: ChunkCoord): void {
    const seed = this.ecosystem.seed;
    const root = new THREE.Group();
    const spots = plantsInChunk(this.ecosystem, coord).map((spot) => {
      const [x, y, z] = spot.position;
      const surface = terrainSurfaceHeight(x, z, seed);
      return {
        ...spot,
        position: [x, surface, z] as Vec3,
        scanPoint: [spot.scanPoint[0], spot.scanPoint[1] + surface - y, spot.scanPoint[2]] as Vec3,
      };
    });
    const plantModels: THREE.Object3D[] = [];
    const generatedSpots = spots.filter((spot) => {
      const template = this.models.get(spot.speciesId);
      if (!template) return true;
      const model = template.clone();
      model.position.set(...spot.position);
      model.rotation.y = spot.yawRad;
      model.scale.multiplyScalar(spot.scale);
      root.add(model);
      plantModels.push(model);
      return false;
    });
    let plants: THREE.Mesh | undefined;
    if (generatedSpots.length > 0) {
      const geometry = plantChunkGeometry(generatedSpots, (id) => this.plantTemplateOf(id));
      plants = new THREE.Mesh(geometry, this.material);
      root.add(plants);
    }
    const herds = herdsInChunk(this.ecosystem, coord).map((herd) => this.herdView(herd));
    for (const view of herds) {
      for (const member of view.animals) this.scene.add(member.group);
    }
    const predators = predatorsInChunk(this.ecosystem, coord).map((predator) =>
      this.creatureView(predator, this.kindOf(predator.speciesId)),
    );
    for (const member of predators) this.scene.add(member.group);
    const marks: PlacedMark[] = predators.flatMap((view) =>
      view.creature.marks.map((mark) => ({
        kind: mark.kind,
        position: [mark.x, terrainSurfaceHeight(mark.x, mark.z, seed), mark.z] as Vec3,
        yawRad: mark.yawRad,
      })),
    );
    let markMesh: THREE.Mesh | undefined;
    if (marks.length > 0) {
      markMesh = new THREE.Mesh(territoryMarkGeometry(marks), this.material);
      root.add(markMesh);
    }
    this.scene.add(root);
    this.chunks.set(chunkKey(coord), {
      root,
      bounds: new THREE.Box3().setFromObject(root),
      plants,
      plantModels,
      marks: markMesh,
      plantTargets: spots.map((spot) => ({ speciesId: spot.speciesId, position: spot.scanPoint })),
      herds,
      predators,
    });
  }

  private remove(key: string, chunk: LifeChunk): void {
    this.scene.remove(chunk.root);
    if (chunk.plants) chunk.plants.geometry.dispose();
    if (chunk.marks) chunk.marks.geometry.dispose();
    for (const view of chunk.herds) {
      for (const member of view.animals) this.scene.remove(member.group);
    }
    for (const member of chunk.predators) this.scene.remove(member.group);
    this.chunks.delete(key);
  }

  private callerOf(view: CreatureView<Creature>): Caller {
    return { x: view.creature.x, z: view.creature.z, bodyLengthM: view.species.bodyLengthM };
  }

  private herdView(herd: Herd): HerdView {
    const kind = this.kindOf(herd.speciesId);
    const animals = herd.animals.map((animal) => this.creatureView(animal, kind));
    return { herd, animals };
  }

  private creatureView<T extends Creature>(creature: T, kind: AnimalKind): CreatureView<T> {
    const group = new THREE.Group();
    const neck = new THREE.Group();
    const model = this.models.get(kind.species.id);
    if (model) {
      group.add(model.clone());
    } else {
      neck.position.set(...neckPoint(kind.species));
      neck.add(new THREE.Mesh(kind.shape.head, this.material));
      group.add(new THREE.Mesh(kind.shape.frame, this.material), neck);
    }
    return {
      creature,
      species: kind.species,
      group,
      neck,
      target: {
        speciesId: kind.species.id,
        position: [creature.x, 0, creature.z],
        creature,
      },
    };
  }

  private place(view: CreatureView<Creature>, heightAt: (x: number, z: number) => number): void {
    const { creature, species } = view;
    const groundM = heightAt(creature.x, creature.z);
    view.group.position.set(creature.x, groundM, creature.z);
    view.group.rotation.set(0, creature.headingRad, creature.mood === 'stunned' ? STUN_LEAN_RAD : 0);
    view.neck.rotation.x = headPitch(creature.mood);
    view.target.position = animalScanPoint(creature, species, groundM);
  }

  private kindOf(speciesId: string): AnimalKind {
    const kind = this.animalKinds.get(speciesId);
    if (!kind) throw new Error(`No animal species ${speciesId}`);
    return kind;
  }

  private plantTemplateOf(speciesId: string): THREE.BufferGeometry {
    const template = this.plantTemplates.get(speciesId);
    if (!template) throw new Error(`No plant species ${speciesId}`);
    return template;
  }
}

function headPitch(mood: Mood | PredatorMood): number {
  switch (mood) {
    case 'graze':
      return GRAZE_HEAD_RAD;
    case 'warn':
      return WARN_HEAD_RAD;
    case 'attack':
      return ATTACK_HEAD_RAD;
    default:
      return 0;
  }
}
