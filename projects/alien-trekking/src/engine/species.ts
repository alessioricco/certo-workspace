export type SpeciesKind = 'plant' | 'animal';

/** What the survey log keeps about a species. */
export interface SpeciesInfo {
  id: string;
  kind: SpeciesKind;
  name: string;
  description: string;
}
