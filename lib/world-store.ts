import { create } from "zustand";

export type DistrictId = "hq" | "builder" | "archive" | "infrastructure";
export type ProjectOccupancy = {
  id: string;
  status: string;
  gridX?: number;
  gridZ?: number;
};

type WorldState = {
  selectedDistrict: DistrictId | null;
  occupiedPlots: Record<string, string>;
  constructionStartedAt: Record<string, number>;
  setSelectedDistrict: (district: DistrictId | null) => void;
  syncProjects: (projects: ProjectOccupancy[]) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  selectedDistrict: null,
  occupiedPlots: {},
  constructionStartedAt: {},
  setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),
  // Neon remains the source of truth; this is the fast client-side occupancy mirror.
  syncProjects: (projects) => set((state) => {
    const occupiedPlots: Record<string, string> = {};
    const constructionStartedAt: Record<string, number> = {};
    for (const project of projects) {
      if (typeof project.gridX === "number" && typeof project.gridZ === "number") {
        occupiedPlots[`${project.gridX},${project.gridZ}`] = project.id;
      }
      if (["under_construction", "initializing"].includes(project.status)) {
        constructionStartedAt[project.id] = state.constructionStartedAt[project.id] ?? Date.now();
      }
    }
    return { occupiedPlots, constructionStartedAt };
  }),
}));
