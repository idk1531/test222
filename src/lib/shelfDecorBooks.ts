import {
  DESK,
  DESK_FOOTPRINT,
  SHELF,
  SHELF_INWARD,
  shelfFrontX,
  shelfPlankCount,
  shelfPlankY,
  type ShelfLayout,
} from "./room3d";

/** Same muted palette used by the bookshelf's decorative books. */
export const SHELF_DECOR_BOOK_COLORS = [
  "#6d5a45", "#8d7a5e", "#cbb994", "#d8c8a8", "#5b4a3c",
  "#3f4a4a", "#4a4f57", "#7d6b57", "#9b8768", "#b8a27e",
  "#8a5a45", "#5d4a3a", "#e0d4bc", "#6f6353",
] as const;

export interface ShelfDecorBook {
  /** Stable spatial ID; it is transient until this book receives written content. */
  id: string;
  /** Shelf plank index, or -1 for the ledge/desk/floor book stacks. */
  plankIndex: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  color: string;
  /** Horizontal ledge stacks keep their original paper-edge faces. */
  pageEdges: boolean;
}

type ShelfDecorBookDraft = Omit<ShelfDecorBook, "id">;

/** Deterministic pseudo-random generator keeps the shelf appearance stable. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stableBookId(book: ShelfDecorBookDraft): string {
  const signature = [book.plankIndex, book.x, book.z, book.sx, book.sy, book.sz, book.ry]
    .map((value) => typeof value === "number" ? value.toFixed(4) : String(value))
    .join("-");
  return `decor-${signature}`;
}

/** Deterministic warm decorative color for a written book without an inherited blank-book color. */
export function decorBookColorForId(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return SHELF_DECOR_BOOK_COLORS[(hash >>> 0) % SHELF_DECOR_BOOK_COLORS.length];
}

/**
 * Build the same decorative books that ShelfDecor renders, including the small horizontal stacks.
 * Both the renderer and room interactions consume this list so visible blank books always have a
 * stable transient ID and the same transform/color.
 */
export function makeShelfDecorBooks(layout: ShelfLayout): ShelfDecorBook[] {
  const inward = SHELF_INWARD;
  const frontX = shelfFrontX();
  const plankCount = shelfPlankCount(layout.rows.length);
  const boardsByPlank = new Map<number, ShelfLayout["rows"][number]["boards"]>();
  layout.rows.forEach((entry) => boardsByPlank.set(entry.plankIndex, entry.boards));
  const rng = makeRng(20261018);
  const books: ShelfDecorBookDraft[] = [];
  const zStart = SHELF.z - SHELF.width / 2 + 0.03;
  const zEnd = SHELF.z + SHELF.width / 2 - 0.03;

  const pushBook = (
    plankIndex: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry: number,
    color: string = SHELF_DECOR_BOOK_COLORS[
      Math.floor(rng() * SHELF_DECOR_BOOK_COLORS.length) % SHELF_DECOR_BOOK_COLORS.length
    ],
    pageEdges = false,
  ) => {
    books.push({ plankIndex, x, y, z, sx, sy, sz, ry, color, pageEdges });
  };

  /** Fill a free shelf run with upright books and occasional horizontal stacks. */
  const fillRun = (plankIndex: number, a: number, b: number, plankY: number, allowStacks: boolean) => {
    if (b - a < 0.05) return;
    let z = a;
    while (z < b - 0.03) {
      if (allowStacks && b - z > 0.3 && rng() < 0.12) {
        const count = 3 + Math.floor(rng() * 3);
        const depth = 0.17 + rng() * 0.03;
        const len = 0.21 + rng() * 0.04;
        let y = plankY;
        for (let index = 0; index < count; index++) {
          pushBook(
            plankIndex,
            frontX - inward * (depth / 2),
            y + 0.016,
            z + len / 2,
            depth,
            0.032,
            len - index * 0.008,
            0,
          );
          y += 0.032;
        }
        z += 0.27;
        continue;
      }
      const thickness = 0.022 + rng() * 0.026;
      if (z + thickness > b) break;
      const height = 0.16 + rng() * 0.075;
      const depth = 0.16 + rng() * 0.04;
      pushBook(
        plankIndex,
        frontX - inward * (depth / 2),
        plankY + height / 2 + 0.0015,
        z + thickness / 2,
        depth,
        height,
        thickness,
        0,
      );
      z += thickness + 0.002 + (rng() < 0.08 ? 0.02 : 0);
    }
  };

  const topShelfFrameZ = SHELF.z - SHELF.width * 0.1;
  for (let plankIndex = 0; plankIndex < plankCount; plankIndex++) {
    const plankY = shelfPlankY(plankIndex, plankCount);
    const occupied: Array<readonly [number, number]> = [];
    for (const board of boardsByPlank.get(plankIndex) ?? []) {
      occupied.push([board.z0, Math.min(board.z1, board.z0 + SHELF.labelWidth)] as const);
      for (const item of board.books) {
        occupied.push([
          item.z - item.thickness / 2 - 0.003,
          item.z + item.thickness / 2 + 0.003,
        ] as const);
      }
    }
    occupied.sort((left, right) => left[0] - right[0]);
    const reserved: Array<[number, number]> =
      plankIndex === 0 ? [[topShelfFrameZ - 0.2, topShelfFrameZ + 0.2]] : [];
    let cursor = zStart;
    const fillFree = (from: number, to: number) => {
      let start = from;
      for (const [reservedStart, reservedEnd] of reserved) {
        if (reservedEnd <= start || reservedStart >= to) continue;
        fillRun(plankIndex, start, Math.min(to, reservedStart), plankY, true);
        start = Math.max(start, reservedEnd);
      }
      fillRun(plankIndex, start, to, plankY, true);
    };
    for (const [start, end] of occupied) {
      if (start - cursor > 0.05) fillFree(cursor, start - 0.015);
      cursor = Math.max(cursor, end + 0.015);
    }
    if (zEnd - cursor > 0.05) fillFree(cursor, zEnd);
  }

  // Ledge, low-shelf and floor stacks remain visually identical, but are now real blank books too.
  {
    const stackColors = ["#3a3f47", "#7a3b34", "#c9b999", "#4a4f57", "#8a6a4a", "#6b5a45"];
    const ledgeLength = SHELF.ledge.z1 - SHELF.ledge.z0;
    const lowShelfLength = SHELF.lowShelf.z1 - SHELF.lowShelf.z0;
    const stackSpecs: Array<[number, number, number]> = [
      [SHELF.ledge.top, SHELF.ledge.z0 + ledgeLength * 0.22, 4],
      [SHELF.ledge.top, SHELF.ledge.z0 + ledgeLength * 0.88, 3],
      [SHELF.lowShelf.top, SHELF.lowShelf.z0 + lowShelfLength * 0.35, 5],
      [SHELF.lowShelf.top, SHELF.lowShelf.z0 + lowShelfLength * 0.68, 4],
      [0.02, SHELF.z + SHELF.width * 0.05, 5],
    ];
    stackSpecs.forEach(([baseY, z, count], stackIndex) => {
      const length = 0.3 + (stackIndex % 3) * 0.04;
      const width = 0.22 + (stackIndex % 2) * 0.03;
      for (let index = 0; index < count; index++) {
        const height = 0.03 + ((stackIndex + index) % 3) * 0.008;
        pushBook(
          -1,
          SHELF.xBack + inward * (width / 2 + 0.03 + (index % 2) * 0.008),
          baseY + height / 2 + index * 0.034 + 0.002,
          z + (index % 2 === 0 ? 0.01 : -0.012),
          width - index * 0.008,
          height,
          length - index * 0.012,
          (index % 3 - 1) * 0.05,
          stackColors[(stackIndex + index) % stackColors.length],
          true,
        );
      }
    });
  }

  // Books on the west return desk are also part of the same transient empty-book set.
  {
    const stackColors = ["#3a3f47", "#7a3b34", "#c9b999", "#4a4f57"];
    const sideDesk = DESK_FOOTPRINT[1];
    const sideDeskEdgeX = inward > 0 ? sideDesk.minX : sideDesk.maxX;
    const baseZ = sideDesk.minZ + (sideDesk.maxZ - sideDesk.minZ) * 0.28;
    for (let index = 0; index < 4; index++) {
      pushBook(
        -1,
        sideDeskEdgeX + inward * 0.17,
        DESK.top + 0.017 + index * 0.032,
        baseZ + (index % 2 ? 0.01 : -0.008),
        0.2 - index * 0.008,
        0.03,
        0.29 - index * 0.01,
        (index % 2 ? -1 : 1) * 0.04,
        stackColors[index],
      );
    }
  }

  const seen = new Map<string, number>();
  return books.map((book) => {
    const id = stableBookId(book);
    const occurrence = seen.get(id) ?? 0;
    seen.set(id, occurrence + 1);
    return { ...book, id: occurrence === 0 ? id : `${id}-${occurrence}` };
  });
}
