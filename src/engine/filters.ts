import { NormalizedOdd, EngineFilters } from '../types';

export function passesFilters(odd: NormalizedOdd, filters: EngineFilters): boolean {
  return (
    odd.odd >= filters.minOdd &&
    odd.odd <= filters.maxOdd
  );
}

export function meetsMinEdge(edgePct: number, filters: EngineFilters): boolean {
  return edgePct >= filters.minEdgePct;
}
