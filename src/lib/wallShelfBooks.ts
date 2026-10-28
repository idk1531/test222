import { NESTED_CITY, ROOM, SHELF, type CityPlanPoint, type CityTrapezoidWallSegment } from "./room3d";
import { SHELF_DECOR_BOOK_COLORS, type ShelfDecorBook } from "./shelfDecorBooks";

export const WALL_SHELF_BAY_WIDTH = 2.75;
export const WALL_SHELF_FRAME_THICKNESS = 0.045;
export const WALL_SHELF_FRAME_DEPTH = SHELF.depth + 0.02;
export const WALL_SHELF_FRAME_HEIGHT = 3.76;
export const WALL_SHELF_CAP_HEIGHT = 0.1;
export const WALL_SHELF_ROW_COUNT = 6;
export const WALL_SHELF_ROW_PITCH = 0.55;

export interface WallShelfDecorBook extends ShelfDecorBook {
  wallId: "BC" | "AD";
  floorY: number;
  rowIndex: number;
}

function segmentLength(segment: CityTrapezoidWallSegment): number {
  return Math.hypot(segment.to.x - segment.from.x, segment.to.z - segment.from.z);
}

function segmentYaw(segment: CityTrapezoidWallSegment): number {
  return Math.atan2(segment.to.x - segment.from.x, segment.to.z - segment.from.z);
}

function pointAlong(segment: CityTrapezoidWallSegment, distance: number, length: number): CityPlanPoint {
  const t = distance / length;
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * t,
    z: segment.from.z + (segment.to.z - segment.from.z) * t,
  };
}

function offsetPoint(point: CityPlanPoint, direction: CityPlanPoint, distance: number): CityPlanPoint {
  return { x: point.x + direction.x * distance, z: point.z + direction.z * distance };
}

/**
 * Stable, transient empty books for every multi-level side-wall bookcase.
 * These transforms are shared by the wall renderer and StudyRoomView's blank-book interaction flow.
 */
export function makeNestedWallShelfDecorBooks(): WallShelfDecorBook[] {
  const walls = NESTED_CITY.trapezoid.wallEdges.filter((wall) => wall.id === "BC" || wall.id === "AD");
  const books: WallShelfDecorBook[] = [];

  walls.forEach((wall, wallIndex) => {
    const length = segmentLength(wall);
    const yaw = segmentYaw(wall);
    const first = 0.55;
    const last = length - 0.55;
    const bayCount = Math.ceil((last - first) / WALL_SHELF_BAY_WIDTH);
    const bayLength = (last - first) / bayCount;
    const bays = Array.from({ length: bayCount }, (_, index) => ({
      index,
      start: first + index * bayLength,
      end: first + (index + 1) * bayLength,
    }));
    const wallId = wall.id as "BC" | "AD";

    NESTED_CITY.levels.forEach((floorY, floorIndex) => {
      bays.forEach((bay) => {
        for (let row = 0; row < WALL_SHELF_ROW_COUNT; row++) {
          const boardTopY = floorY + WALL_SHELF_FRAME_HEIGHT - WALL_SHELF_CAP_HEIGHT - row * WALL_SHELF_ROW_PITCH;
          const bookStart = bay.start + WALL_SHELF_FRAME_THICKNESS / 2 + 0.025;
          const bookEnd = bay.end - WALL_SHELF_FRAME_THICKNESS / 2 - 0.025;
          let distance = bookStart;
          let bookIndex = 0;

          while (distance < bookEnd - 0.022) {
            const pattern = wallIndex * 13 + bay.index * 7 + row * 11 + bookIndex * 5 + floorIndex * 3;
            const thickness = 0.022 + (pattern % 27) * 0.001;
            if (distance + thickness > bookEnd) break;
            const height = 0.16 + ((pattern * 3) % 8) * 0.01;
            const depth = 0.16 + ((pattern * 7) % 5) * 0.01;
            const centerOnWall = pointAlong(wall, distance + thickness / 2, length);
            const bookCenter = offsetPoint(
              centerOnWall,
              wall.inward,
              ROOM.wall + SHELF.depth - 0.012 - depth / 2,
            );

            books.push({
              id: `wall-${wallId}-floor-${floorY}-bay-${bay.index}-row-${row}-book-${bookIndex}`,
              plankIndex: -2,
              x: bookCenter.x,
              y: boardTopY + 0.0015 + height / 2,
              z: bookCenter.z,
              sx: depth,
              sy: height,
              sz: thickness,
              ry: yaw,
              color: SHELF_DECOR_BOOK_COLORS[pattern % SHELF_DECOR_BOOK_COLORS.length],
              pageEdges: false,
              wallId,
              floorY,
              rowIndex: row,
            });

            distance += thickness + 0.002 + (bookIndex % 17 === 0 ? 0.018 : 0);
            bookIndex++;
          }
        }
      });
    });
  });

  return books;
}
