// Spatial index for viewport culling and hit testing.
// Wraps rbush for fast rectangle queries over 1000+ table nodes.

import RBush from 'rbush';

/** An axis-aligned bounding box with a unique identifier. */
export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

/**
 * Spatial index backed by an R-tree (rbush).
 *
 * Provides O(log n) insertion/removal and fast viewport queries for the
 * ERD canvas. Designed for 1000+ table nodes with frequent viewport culling
 * on every frame.
 */
export class SpatialIndex {
  private tree: RBush<SpatialItem>;

  /** Map from id to the live item reference stored in the tree. */
  private itemById = new Map<string, SpatialItem>();

  constructor() {
    this.tree = new RBush<SpatialItem>();
  }

  // -------------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------------

  /**
   * Bulk-load items into the tree.
   *
   * ~2-3x faster than inserting one-by-one and yields better subsequent query
   * performance. Clears existing data before loading.
   */
  load(items: SpatialItem[]): void {
    this.tree.clear();
    this.itemById.clear();

    for (const item of items) {
      this.itemById.set(item.id, item);
    }

    this.tree.load(items);
  }

  // -------------------------------------------------------------------------
  // Single-item mutations
  // -------------------------------------------------------------------------

  /** Insert a single item. Use {@link load} for batch inserts. */
  insert(item: SpatialItem): void {
    // Remove stale entry if the id already exists (idempotent upsert).
    const existing = this.itemById.get(item.id);
    if (existing) {
      this.tree.remove(existing, (a, b) => a.id === b.id);
    }
    this.itemById.set(item.id, item);
    this.tree.insert(item);
  }

  /** Remove an item by its id. No-op if the id is not found. */
  remove(id: string): void {
    const item = this.itemById.get(id);
    if (!item) return;
    this.tree.remove(item, (a, b) => a.id === b.id);
    this.itemById.delete(id);
  }

  /**
   * Update the bounding box of an existing item.
   *
   * Internally this removes and re-inserts the item because rbush does not
   * support in-place mutation. For bulk updates, prefer {@link load}.
   */
  update(id: string, minX: number, minY: number, maxX: number, maxY: number): void {
    const existing = this.itemById.get(id);
    if (existing) {
      this.tree.remove(existing, (a, b) => a.id === b.id);
    }
    const item: SpatialItem = { minX, minY, maxX, maxY, id };
    this.itemById.set(id, item);
    this.tree.insert(item);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Return all items whose bounding boxes intersect the given viewport bounds.
   *
   * Typically called once per frame with the result of
   * `getViewportBounds(camera, w, h)` to determine which nodes to render.
   */
  queryViewport(bounds: { minX: number; minY: number; maxX: number; maxY: number }): SpatialItem[] {
    return this.tree.search(bounds);
  }

  /**
   * Find the *topmost* item at a world-space point.
   *
   * When multiple items overlap, the last one inserted (highest index) is
   * returned -- this matches typical rendering order where later items paint
   * on top of earlier ones.
   *
   * Returns `null` if no item contains the point.
   */
  hitTest(worldX: number, worldY: number): SpatialItem | null {
    const hits = this.tree.search({
      minX: worldX,
      minY: worldY,
      maxX: worldX,
      maxY: worldY,
    });

    if (hits.length === 0) return null;

    // Return the last match -- closest to the top of the render order.
    return hits[hits.length - 1];
  }

  /** Remove all items from the index. */
  clear(): void {
    this.tree.clear();
    this.itemById.clear();
  }

  /** Return the number of items currently in the index. */
  get size(): number {
    return this.itemById.size;
  }
}
