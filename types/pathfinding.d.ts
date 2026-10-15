declare module "pathfinding" {
  type Point = [number, number];
  type FinderOptions = {
    allowDiagonal?: boolean;
    dontCrossCorners?: boolean;
  };
  class Grid {
    constructor(width: number, height: number);
    setWalkableAt(x: number, y: number, walkable: boolean): void;
  }
  type AStarFinderInstance = {
    findPath(startX: number, startY: number, endX: number, endY: number, grid: Grid): Point[];
  };
  const PF: {
    Grid: typeof Grid;
    AStarFinder: new (options?: FinderOptions) => AStarFinderInstance;
  };
  export default PF;
}
