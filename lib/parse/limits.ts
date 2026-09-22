/**
 * Upload cap, shared by the drop zone, the upload action and the parser.
 * Vercel rejects function request bodies over 4.5 MB before any code runs, so
 * the file stays under that with room for the job description and form
 * overhead; next.config.ts raises Next's own server-action limit above it.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_LABEL = '4 MB';
