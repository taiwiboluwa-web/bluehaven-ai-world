import { create } from "zustand";

export type DistrictId = "hq" | "builder" | "archive" | "infrastructure";
type WorldState = {
  selectedDistrict: DistrictId | null;
  setSelectedDistrict: (district: DistrictId | null) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  selectedDistrict: null,
  setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),
}));
