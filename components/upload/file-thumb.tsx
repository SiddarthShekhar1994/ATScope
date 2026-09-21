'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/primitives';

/**
 * Renders the first page of the dropped file while the server parses it:
 * PDFs through pdf.js on a canvas, DOCX through mammoth as scaled HTML.
 * Explicit dimensions so nothing shifts when the render lands.
 */
export function FileThumb({ file, className, width = 180 }: { file: File | null; className?: string; width?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'rendering' | 'done' | 'failed'>('idle');
  const height = Math.round(width * 1.294); // US Letter
  useEffect(() => {
    if (!file) {
      setState('idle');
      setHtml(null);
      return;
    }
    let cancelled = false;
    setState('rendering');
    setHtml(null);
    (async () => {
      try {
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
          const data = new Uint8Array(await file.arrayBuffer());
          const doc = await pdfjs.getDocument({ data }).promise;
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const scale = (width * (window.devicePixelRatio || 1)) / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (!cancelled) setState('done');
        } else {
          const mammoth = (await import('mammoth')).default;
          const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
          if (!cancelled) {
            setHtml(result.value);
            setState('done');
          }
        }
      } catch (err) {
        console.warn('[thumb]', err);
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, width]);

  const isPdf = !!file && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  return (
    <div className={cn('relative overflow-hidden rounded-r2 border border-line bg-[#f6f3ec] shadow-2', className)} style={{ width, height }} aria-hidden>
      {state === 'rendering' ? <Skeleton className="absolute inset-0 rounded-none bg-[#e9e5dc]" /> : null}
      <canvas ref={canvasRef} className={cn('block h-full w-full', !isPdf && 'hidden')} style={{ width, height }} />
      {html !== null ? (
        <div className="absolute inset-0 origin-top-left overflow-hidden p-[6%] text-[#222]" style={{ transform: `scale(${width / 612})`, width: 612, height: 792 }}>
          <div className="prose-thumb text-[11px] leading-[1.35]" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      ) : null}
      {state === 'failed' ? <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-[#6b665c]">Preview unavailable — the server will still parse it.</div> : null}
      {state === 'idle' ? (
        <div className="absolute inset-0 flex flex-col gap-2 p-4">
          <div className="h-3 w-1/2 rounded-sm bg-[#d9d4c8]" />
          <div className="h-2 w-2/3 rounded-sm bg-[#e4dfd3]" />
          <div className="mt-2 h-2 w-full rounded-sm bg-[#e4dfd3]" />
          <div className="h-2 w-11/12 rounded-sm bg-[#e4dfd3]" />
          <div className="h-2 w-4/5 rounded-sm bg-[#e4dfd3]" />
        </div>
      ) : null}
      <style>{`.prose-thumb p{margin:0 0 .35em}.prose-thumb h1,.prose-thumb h2,.prose-thumb h3{font-size:1.15em;margin:.5em 0 .2em;font-weight:600}.prose-thumb ul{padding-left:1.1em;margin:.2em 0}.prose-thumb table{border-collapse:collapse;width:100%}.prose-thumb td{vertical-align:top;padding:2px 4px;border:1px solid #ddd}`}</style>
    </div>
  );
}
