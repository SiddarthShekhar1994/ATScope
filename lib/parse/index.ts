import { extractPdf } from './pdf';
import { extractDocx } from './docx';
import { buildParsedResume } from './ats-simulation';
import { rawFromText } from './from-text';
import type { ParsedResume, RawExtraction } from './types';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'unsupported' | 'empty' | 'scanned' | 'corrupt' | 'too-large',
  ) {
    super(message);
  }
}

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function sniffFileType(bytes: Uint8Array, fileName: string): 'pdf' | 'docx' | 'text' | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'docx';
  if (/\.pdf$/i.test(fileName)) return 'pdf';
  if (/\.docx$/i.test(fileName)) return 'docx';
  if (/\.(txt|md)$/i.test(fileName)) return 'text';
  return null;
}

export async function parseResumeFile(bytes: Uint8Array, fileName: string, id: string): Promise<ParsedResume> {
  if (bytes.length > MAX_FILE_BYTES) throw new ParseError('That file is over 8 MB. Resumes are usually under 1 MB; export a lighter PDF.', 'too-large');
  const type = sniffFileType(bytes, fileName);
  if (!type) throw new ParseError('Only PDF and DOCX files are supported. Legacy .doc files need to be re-saved as .docx.', 'unsupported');
  const started = Date.now();
  let raw: RawExtraction;
  try {
    if (type === 'pdf') raw = await extractPdf(bytes);
    else if (type === 'docx') raw = await extractDocx(bytes);
    else raw = rawFromText(new TextDecoder().decode(bytes));
  } catch (err) {
    throw new ParseError(`The file could not be opened: ${(err as Error).message}`, 'corrupt');
  }
  const chars = raw.items.reduce((n, i) => n + i.text.length, 0);
  if (chars < 40) {
    if (type === 'pdf' && raw.images.length > 0) {
      throw new ParseError('This PDF has no text layer, only images. An ATS cannot read it either. Export a text PDF from your editor instead of scanning.', 'scanned');
    }
    throw new ParseError('No readable text was found in the file.', 'empty');
  }
  return buildParsedResume(raw, { id, fileName, fileSize: bytes.length, parserMs: Date.now() - started });
}

export { buildParsedResume } from './ats-simulation';
export { parseFromText, rawFromText } from './from-text';
export * from './types';
