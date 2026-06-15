import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { NODE_WIDTH, HEADER_HEIGHT, ROW_HEIGHT, PADDING_X, COLORS, LOD, FONT_FAMILY } from './constants';
import type { Column } from '@/types/schema';

// ── Public interface ────────────────────────────────────────────────
export interface TableNodeData {
  id: string;
  tableName: string;
  columns: Column[];
  fkColumnIds: string[];
  selected: boolean;
}

// ── Shared text styles (created once, reused across all instances) ──
const STYLE_HEADER_NAME = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 13,
  fill: COLORS.text,
});

const STYLE_COLUMN_COUNT = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 10,
  fill: COLORS.textDim,
});

const STYLE_COLUMN_NAME = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 11,
  fill: COLORS.text,
  lineHeight: ROW_HEIGHT,
});

const STYLE_COLUMN_TYPE = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 10,
  fill: COLORS.textDim,
  lineHeight: ROW_HEIGHT,
  align: 'right',
});

const STYLE_BADGE_PK = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 9,
  fill: COLORS.pkColor,
  fontWeight: 'bold',
  lineHeight: ROW_HEIGHT,
});

const STYLE_BADGE_FK = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 9,
  fill: COLORS.fkColor,
  fontWeight: 'bold',
  lineHeight: ROW_HEIGHT,
});

const STYLE_BADGE_UQ = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 9,
  fill: COLORS.uqColor,
  fontWeight: 'bold',
  lineHeight: ROW_HEIGHT,
});

// ── Constants ───────────────────────────────────────────────────────
const CORNER_RADIUS = 8;
const DOT_CORNER_RADIUS = 4;
const BORDER_WIDTH = 1;
const BAR_HEIGHT = 6;
const BAR_WIDTH = 30;
const DETAIL_ZOOM_THRESHOLD = 0.5;
const MAX_BARS_WHEN_SIMPLIFIED = 24;
const MAX_BARS_WHEN_SIMPLIFIED_DYNAMIC = 120;
const TARGET_SIMPLIFIED_BAR_SPACING = 14;
const MIN_SIMPLIFIED_BAR_HEIGHT = 3;
const BADGE_OVERLAY_X = PADDING_X - 2;
const BADGE_TEXT_TOP_PAD = (ROW_HEIGHT - 9) / 2;
const NAME_TEXT_TOP_PAD = (ROW_HEIGHT - 11) / 2;
const TYPE_TEXT_TOP_PAD = (ROW_HEIGHT - 10) / 2;
const NAME_LEFT_INSET = 12;
const TYPE_COLUMN_RESERVED_WIDTH = 108;
const MEASURE_TEXT = new Text({ text: '', style: STYLE_COLUMN_NAME });

// ── Renderer ────────────────────────────────────────────────────────
export class TableNodeRenderer {
  readonly container: Container;
  readonly id: string;

  // Current state
  private data: TableNodeData;
  private currentLOD: LOD = LOD.FULL;
  private currentZoom = 1;
  private renderQualityLevel: 0 | 1 | 2 = 1;

  // Shared background graphics (redrawn per LOD/data change)
  private bg: Graphics;

  // FULL + SKELETON: header text
  private nameText: Text;
  private countText: Text;

  // FULL: detailed columns as multiline texts (object count minimized)
  private badgePkText: Text;
  private badgeFkText: Text;
  private badgeUqText: Text;
  private detailNameText: Text;
  private detailTypeText: Text;

  // SKELETON: column color bars
  private barsGraphics: Graphics;

  constructor(data: TableNodeData) {
    this.id = data.id;
    this.data = data;

    this.container = new Container();
    this.container.sortableChildren = false;
    this.container.label = `table-${data.id}`;

    // Background (used by all LODs, redrawn per LOD)
    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // Header texts (shared by FULL and SKELETON)
    this.nameText = new Text({ text: '', style: STYLE_HEADER_NAME });
    this.nameText.anchor.set(0, 0.5);
    this.container.addChild(this.nameText);

    this.countText = new Text({ text: '', style: STYLE_COLUMN_COUNT });
    this.countText.anchor.set(1, 0.5);
    this.container.addChild(this.countText);

    this.badgePkText = new Text({ text: '', style: STYLE_BADGE_PK });
    this.badgePkText.anchor.set(0, 0);
    this.container.addChild(this.badgePkText);

    this.badgeFkText = new Text({ text: '', style: STYLE_BADGE_FK });
    this.badgeFkText.anchor.set(0, 0);
    this.container.addChild(this.badgeFkText);

    this.badgeUqText = new Text({ text: '', style: STYLE_BADGE_UQ });
    this.badgeUqText.anchor.set(0, 0);
    this.container.addChild(this.badgeUqText);

    this.detailNameText = new Text({ text: '', style: STYLE_COLUMN_NAME });
    this.detailNameText.anchor.set(0, 0);
    this.container.addChild(this.detailNameText);

    this.detailTypeText = new Text({ text: '', style: STYLE_COLUMN_TYPE });
    this.detailTypeText.anchor.set(1, 0);
    this.container.addChild(this.detailTypeText);

    // SKELETON: colored bars
    this.barsGraphics = new Graphics();
    this.container.addChild(this.barsGraphics);

    // Initial render
    this.render();
  }

  // ── Public API ──────────────────────────────────────────────────

  update(data: TableNodeData): void {
    this.data = data;
    this.render();
  }

  setSelected(selected: boolean): void {
    if (this.data.selected === selected) return;
    this.data = { ...this.data, selected };
    this.render();
  }

  setLOD(lod: LOD): void {
    if (lod === this.currentLOD) return;
    this.currentLOD = lod;
    this.render();
  }

  setZoom(zoom: number): void {
    if (Math.abs(this.currentZoom - zoom) < 0.01) return;
    const prevDetailed = this.isDetailedMode();
    this.currentZoom = zoom;
    const nextDetailed = this.isDetailedMode();
    if (prevDetailed !== nextDetailed && this.currentLOD === LOD.FULL) {
      this.render();
    }
  }

  setRenderQualityLevel(level: 0 | 1 | 2): void {
    if (this.renderQualityLevel === level) return;
    this.renderQualityLevel = level;
    this.render();
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.position.x, y: this.container.position.y };
  }

  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const { x, y } = this.container.position;
    const h = this.getHeight();
    return { minX: x, minY: y, maxX: x + NODE_WIDTH, maxY: y + h };
  }

  getHeight(): number {
    return HEADER_HEIGHT + this.data.columns.length * ROW_HEIGHT + PADDING_X;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  /** Full redraw based on current LOD and data. */
  private render(): void {
    switch (this.currentLOD) {
      case LOD.FULL:
        this.renderFull();
        break;
      case LOD.SKELETON:
        this.renderSkeleton();
        break;
      case LOD.DOT:
        this.renderDot();
        break;
    }
  }

  // ── LOD.FULL ────────────────────────────────────────────────────

  private renderFull(): void {
    const { data } = this;
    const height = this.getHeight();
    const selected = data.selected;
    const borderColor = selected ? COLORS.borderSelected : COLORS.border;
    const headerBg = selected ? COLORS.headerBgSelected : COLORS.headerBg;

    // Background
    this.bg.clear()
      .roundRect(0, 0, NODE_WIDTH, height, CORNER_RADIUS)
      .fill(COLORS.bg)
      .rect(0, 0, NODE_WIDTH, HEADER_HEIGHT)
      .fill(headerBg)
      .moveTo(0, HEADER_HEIGHT)
      .lineTo(NODE_WIDTH, HEADER_HEIGHT)
      .stroke({ color: COLORS.separator, width: 1 })
      .roundRect(0, 0, NODE_WIDTH, height, CORNER_RADIUS)
      .stroke({ color: borderColor, width: BORDER_WIDTH });

    // Column count
    this.countText.text = `${data.columns.length}`;
    this.countText.position.set(NODE_WIDTH - PADDING_X, HEADER_HEIGHT / 2);
    this.countText.visible = true;

    // Header name (reserve right space for count text first)
    const headerNameMaxWidth = NODE_WIDTH - PADDING_X * 3 - this.countText.width;
    const truncatedName = truncateByWidth(data.tableName, headerNameMaxWidth, STYLE_HEADER_NAME);
    this.nameText.text = truncatedName;
    this.nameText.position.set(PADDING_X, HEADER_HEIGHT / 2);
    this.nameText.visible = true;

    if (this.isDetailedMode()) {
      // Column detail rows as multiline texts: same visual info, far fewer objects.
      const fkSet = new Set(data.fkColumnIds);
      const pkLines: string[] = [];
      const fkLines: string[] = [];
      const uqLines: string[] = [];
      const nameLines: string[] = [];
      const typeLines: string[] = [];
      const typeWidths: number[] = [];
      for (let i = 0; i < data.columns.length; i++) {
        const col = data.columns[i];
        const badge = getBadgeLabel(col, fkSet);
        pkLines.push(badge === 'PK' ? 'PK' : '');
        fkLines.push(badge === 'FK' ? 'FK' : '');
        uqLines.push(badge === 'UQ' ? 'UQ' : '');
        const typeText = truncateByWidth(col.dataType, TYPE_COLUMN_RESERVED_WIDTH - 8, STYLE_COLUMN_TYPE);
        typeLines.push(typeText);
        typeWidths.push(measureTextWidth(typeText, STYLE_COLUMN_TYPE));
      }
      for (let i = 0; i < data.columns.length; i++) {
        const nameMaxWidth = NODE_WIDTH
          - (PADDING_X + NAME_LEFT_INSET)
          - PADDING_X
          - Math.max(28, typeWidths[i] + 12);
        nameLines.push(truncateByWidth(data.columns[i].name, nameMaxWidth, STYLE_COLUMN_NAME));
      }

      this.badgePkText.text = pkLines.join('\n');
      this.badgePkText.position.set(BADGE_OVERLAY_X, HEADER_HEIGHT + BADGE_TEXT_TOP_PAD);
      this.badgePkText.visible = true;

      this.badgeFkText.text = fkLines.join('\n');
      this.badgeFkText.position.set(BADGE_OVERLAY_X, HEADER_HEIGHT + BADGE_TEXT_TOP_PAD);
      this.badgeFkText.visible = true;

      this.badgeUqText.text = uqLines.join('\n');
      this.badgeUqText.position.set(BADGE_OVERLAY_X, HEADER_HEIGHT + BADGE_TEXT_TOP_PAD);
      this.badgeUqText.visible = true;

      this.detailNameText.text = nameLines.join('\n');
      this.detailNameText.position.set(PADDING_X + NAME_LEFT_INSET, HEADER_HEIGHT + NAME_TEXT_TOP_PAD);
      this.detailNameText.visible = true;

      this.detailTypeText.text = typeLines.join('\n');
      this.detailTypeText.position.set(NODE_WIDTH - PADDING_X, HEADER_HEIGHT + TYPE_TEXT_TOP_PAD);
      this.detailTypeText.visible = true;

      this.barsGraphics.visible = false;
    } else {
      this.badgePkText.visible = false;
      this.badgeFkText.visible = false;
      this.badgeUqText.visible = false;
      this.detailNameText.visible = false;
      this.detailTypeText.visible = false;
      this.drawSimplifiedBars(data);
    }
  }

  // ── LOD.SKELETON ────────────────────────────────────────────────

  private renderSkeleton(): void {
    const { data } = this;
    const height = this.getHeight();
    const selected = data.selected;
    const borderColor = selected ? COLORS.borderSelected : COLORS.border;
    const headerBg = selected ? COLORS.headerBgSelected : COLORS.headerBg;

    // Background (same structure as FULL)
    this.bg.clear()
      .roundRect(0, 0, NODE_WIDTH, height, CORNER_RADIUS)
      .fill(COLORS.bg)
      .rect(0, 0, NODE_WIDTH, HEADER_HEIGHT)
      .fill(headerBg)
      .roundRect(0, 0, NODE_WIDTH, height, CORNER_RADIUS)
      .stroke({ color: borderColor, width: BORDER_WIDTH });

    // Column count
    this.countText.text = `${data.columns.length}`;
    this.countText.position.set(NODE_WIDTH - PADDING_X, HEADER_HEIGHT / 2);
    this.countText.visible = true;

    // Header name (reserve right space for count)
    const headerNameMaxWidth = NODE_WIDTH - PADDING_X * 3 - this.countText.width;
    const truncatedName = truncateByWidth(data.tableName, headerNameMaxWidth, STYLE_HEADER_NAME);
    this.nameText.text = truncatedName;
    this.nameText.position.set(PADDING_X, HEADER_HEIGHT / 2);
    this.nameText.visible = true;

    this.drawSimplifiedBars(data);

    // Hide full-detail column texts
    this.badgePkText.visible = false;
    this.badgeFkText.visible = false;
    this.badgeUqText.visible = false;
    this.detailNameText.visible = false;
    this.detailTypeText.visible = false;
  }

  // ── LOD.DOT ─────────────────────────────────────────────────────

  private renderDot(): void {
    const { data } = this;
    const fillColor = data.selected ? COLORS.headerBgSelected : COLORS.headerBg;
    const height = this.getHeight();

    this.bg.clear()
      .roundRect(0, 0, NODE_WIDTH, height, DOT_CORNER_RADIUS)
      .fill(fillColor);

    // Hide everything except bg
    this.nameText.visible = false;
    this.countText.visible = false;
    this.badgePkText.visible = false;
    this.badgeFkText.visible = false;
    this.badgeUqText.visible = false;
    this.detailNameText.visible = false;
    this.detailTypeText.visible = false;
    this.barsGraphics.visible = false;
  }

  private isDetailedMode(): boolean {
    if (this.renderQualityLevel === 0) return true;
    if (this.renderQualityLevel === 2) return this.data.selected || this.currentZoom >= 1.15;
    return this.data.selected || this.currentZoom >= DETAIL_ZOOM_THRESHOLD;
  }

  private drawSimplifiedBars(data: TableNodeData): void {
    this.barsGraphics.clear();
    const fkSet = new Set(data.fkColumnIds);
    const totalRows = data.columns.length;
    const bodyHeight = totalRows * ROW_HEIGHT + PADDING_X;
    const desiredCount = Math.ceil(bodyHeight / TARGET_SIMPLIFIED_BAR_SPACING);
    const count = Math.min(
      totalRows,
      Math.min(
        MAX_BARS_WHEN_SIMPLIFIED_DYNAMIC,
        Math.max(MAX_BARS_WHEN_SIMPLIFIED, desiredCount),
      ),
    );
    if (count <= 0) {
      this.barsGraphics.visible = false;
      return;
    }

    // Fill the full body height even when bars are capped, to avoid large empty areas.
    const slotHeight = bodyHeight / count;
    const barHeight = Math.max(MIN_SIMPLIFIED_BAR_HEIGHT, Math.min(BAR_HEIGHT, slotHeight - 2));
    for (let i = 0; i < count; i++) {
      const sourceIndex = count === 1
        ? 0
        : Math.round((i * (totalRows - 1)) / (count - 1));
      const col = data.columns[sourceIndex];
      const barY = HEADER_HEIGHT + i * slotHeight + (slotHeight - barHeight) / 2;
      const color = getBarColor(col, fkSet);
      this.barsGraphics
        .roundRect(PADDING_X, barY, BAR_WIDTH, barHeight, 2)
        .fill(color);
    }
    this.barsGraphics.visible = true;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function measureTextWidth(value: string, style: TextStyle): number {
  MEASURE_TEXT.style = style;
  MEASURE_TEXT.text = value;
  return MEASURE_TEXT.getLocalBounds().width;
}

function truncateByWidth(str: string, maxWidth: number, style: TextStyle): string {
  if (maxWidth <= 0) return '\u2026';
  const measure = (value: string): number => measureTextWidth(value, style);
  if (measure(str) <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const probe = `${str.slice(0, mid)}\u2026`;
    if (measure(probe) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${str.slice(0, lo)}\u2026`;
}

function getBadgeLabel(col: Column, fkSet: Set<string>): '' | 'PK' | 'FK' | 'UQ' {
  if (col.isPrimaryKey) return 'PK';
  if (fkSet.has(col.id)) return 'FK';
  if (col.isUnique) return 'UQ';
  return '';
}

function getBarColor(col: Column, fkSet: Set<string>): number {
  if (col.isPrimaryKey) return COLORS.pkColor;
  if (fkSet.has(col.id)) return COLORS.fkColor;
  if (col.isUnique) return COLORS.uqColor;
  return COLORS.textDim;
}
