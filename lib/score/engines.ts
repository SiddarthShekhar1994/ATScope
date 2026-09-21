import type { ParsedResume } from '../parse/types';
import type { CategoryResult, EngineScore, CategoryId } from './types';

/**
 * Per-engine estimates. Each ATS weighs the same six categories differently
 * and reacts differently to layout hazards. The multipliers below encode the
 * well-documented tendencies: Taleo and Workday are the most layout-sensitive,
 * Greenhouse and Lever the least; Taleo and Workday lean on keywords, Greenhouse
 * on human review. Every engine sees a single-column, table-free document best.
 */
interface EngineProfile {
  engine: EngineScore['engine'];
  label: string;
  weights: Record<CategoryId, number>;
  hazards: { multiColumn: number; tables: number; headerContact: number; images: number; textBoxes: number };
  note: string;
}

const PROFILES: EngineProfile[] = [
  {
    engine: 'workday',
    label: 'Workday',
    weights: { parse: 30, keywords: 25, impact: 15, structure: 15, writing: 10, contact: 5 },
    hazards: { multiColumn: 0.85, tables: 0.9, headerContact: 0.85, images: 0.97, textBoxes: 0.9 },
    note: 'Strict section mapping; drops header text and mis-orders multi-column PDFs.',
  },
  {
    engine: 'greenhouse',
    label: 'Greenhouse',
    weights: { parse: 20, keywords: 20, impact: 25, structure: 15, writing: 15, contact: 5 },
    hazards: { multiColumn: 0.95, tables: 0.95, headerContact: 0.95, images: 1, textBoxes: 0.95 },
    note: 'Modern parser, recruiter-driven review; rewards impact over keyword density.',
  },
  {
    engine: 'lever',
    label: 'Lever',
    weights: { parse: 20, keywords: 25, impact: 20, structure: 15, writing: 15, contact: 5 },
    hazards: { multiColumn: 0.92, tables: 0.9, headerContact: 0.95, images: 1, textBoxes: 0.92 },
    note: 'Solid text extraction; tables and text boxes still flatten badly.',
  },
  {
    engine: 'taleo',
    label: 'Taleo',
    weights: { parse: 35, keywords: 30, impact: 10, structure: 15, writing: 5, contact: 5 },
    hazards: { multiColumn: 0.75, tables: 0.8, headerContact: 0.8, images: 0.9, textBoxes: 0.85 },
    note: 'Oldest parser in wide use; keyword-heavy ranking, harshest on layout.',
  },
];

export function engineScores(doc: ParsedResume, categories: CategoryResult[]): EngineScore[] {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c.score])) as Record<CategoryId, number>;
  const headerContact = doc.contact.inDroppedRegion.length > 0;
  return PROFILES.map((p) => {
    const totalWeight = Object.values(p.weights).reduce((a, b) => a + b, 0);
    let score = 0;
    for (const [id, w] of Object.entries(p.weights) as [CategoryId, number][]) score += ((byId[id] ?? 0) * w) / totalWeight;
    if (!doc.layout.singleColumn) score *= p.hazards.multiColumn;
    if (doc.layout.tableCount > 0) score *= p.hazards.tables;
    if (headerContact) score *= p.hazards.headerContact;
    if (doc.layout.imageCount > 0) score *= p.hazards.images;
    if (doc.layout.textBoxCount > 0) score *= p.hazards.textBoxes;
    return { engine: p.engine, label: p.label, score: Math.min(99, Math.max(0, Math.round(score))), note: p.note };
  });
}
