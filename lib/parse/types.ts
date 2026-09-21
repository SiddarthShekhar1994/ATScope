/**
 * Shared document model. Everything downstream (scoring, planning, rewriting,
 * the report UI) speaks in these types. They are plain JSON so they can be
 * stored in Redis and shipped to the client unchanged.
 */

export type LineKind =
  | 'name'
  | 'contact'
  | 'heading'
  | 'entry'
  | 'bullet'
  | 'text'
  | 'blank';

export type LineSource = 'body' | 'header' | 'footer' | 'table' | 'textbox';

export type SectionId =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'volunteer'
  | 'languages'
  | 'interests'
  | 'other'
  | 'unknown';

/** Normalized page box: x/y/w/h are fractions of page width/height, y measured from the top. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResumeLine {
  /** Stable reference used by findings: "L1", "L2", ... (1-based to match what people see). */
  id: string;
  index: number;
  /** Cleaned text with the bullet glyph removed and whitespace collapsed. */
  text: string;
  /** Text as extracted, including the bullet glyph. */
  raw: string;
  page: number;
  kind: LineKind;
  source: LineSource;
  section: SectionId;
  /** The literal heading text this line lives under, if any. */
  sectionTitle?: string;
  bullet?: string;
  bbox?: BBox;
  /** 0 for the left/only column, 1 for the right column. */
  column?: number;
  font?: { bold?: boolean; size?: number; name?: string };
  /** Index into ParsedResume.entries for lines that belong to a dated entry. */
  entryIndex?: number;
  /** Position of this line in raw extraction (content-stream) order. */
  streamIndex?: number;
}

export interface Section {
  id: SectionId;
  title: string;
  headingLineId?: string;
  lineIds: string[];
  /** True when the heading text is not one an ATS recognises (e.g. "Where I've Worked"). */
  nonStandardHeading?: boolean;
}

export interface Entry {
  id: string;
  section: SectionId;
  title?: string;
  org?: string;
  location?: string;
  dates?: string;
  startYear?: number;
  endYear?: number | 'present';
  headerLineIds: string[];
  bulletLineIds: string[];
  dateParseable: boolean;
}

export type DroppedKind =
  | 'table'
  | 'header'
  | 'footer'
  | 'image'
  | 'textbox'
  | 'icon'
  | 'glyph'
  | 'column'
  | 'shape';

export interface DroppedElement {
  id: string;
  kind: DroppedKind;
  description: string;
  /** The text a human sees in that element, if any. */
  text?: string;
  lineRefs: string[];
  page?: number;
  severity: 'high' | 'medium' | 'low';
}

export interface ReadingOrderIssue {
  id: string;
  kind: 'column-interleave' | 'table-flatten' | 'out-of-order' | 'orphan';
  description: string;
  lineRefs: string[];
}

export interface LayoutInfo {
  pageCount: number;
  columns: number;
  singleColumn: boolean;
  tableCount: number;
  tableCellCount: number;
  headerText: string[];
  footerText: string[];
  imageCount: number;
  textBoxCount: number;
  fonts: string[];
  ligatureLineIds: string[];
  symbolBulletLineIds: string[];
  wordCount: number;
  /** Characters extracted; 0 means an image-only (scanned) document. */
  charCount: number;
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  /** Which line each field was found on. */
  lineRefs: Partial<Record<'name' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website', string>>;
  /** Fields that were found only inside a header/footer/textbox (i.e. invisible to most parsers). */
  inDroppedRegion: string[];
}

export interface AtsLine {
  text: string;
  fromLineIds: string[];
  /** Why this line looks the way it does, when it differs from the human view. */
  note?: string;
  mangled?: boolean;
}

export interface ParsedResume {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text';
  fileSize: number;
  lines: ResumeLine[];
  sections: Section[];
  entries: Entry[];
  layout: LayoutInfo;
  contact: ContactInfo;
  /** What a machine reads: content-stream order, tables flattened, headers/footers/textboxes gone. */
  atsLines: AtsLine[];
  atsPlainText: string;
  dropped: DroppedElement[];
  readingOrderIssues: ReadingOrderIssue[];
  meta: {
    parsedAt: string;
    parserMs: number;
    warnings: string[];
  };
}

/** Raw geometry-aware output of a file parser, before section/entry analysis. */
export interface RawTextItem {
  text: string;
  page: number;
  bbox: BBox;
  font?: { bold?: boolean; size?: number; name?: string };
  source: LineSource;
  /** Content-stream order index within the document. */
  streamIndex: number;
  /** Set for cells so tables can be flattened the way parsers do it. */
  table?: { id: string; row: number; col: number };
  hasEOL?: boolean;
}

export interface RawExtraction {
  fileType: 'pdf' | 'docx' | 'text';
  pageCount: number;
  items: RawTextItem[];
  images: { page: number; bbox?: BBox; description: string }[];
  textBoxes: { page: number; text: string }[];
  tables: { id: string; page: number; rows: number; cols: number; cells: string[] }[];
  headerText: string[];
  footerText: string[];
  fonts: string[];
  /** Column count hint from the source format (e.g. DOCX section columns). */
  declaredColumns?: number;
  warnings: string[];
}
