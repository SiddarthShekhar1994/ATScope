'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { useTransitionRouter } from 'next-view-transitions';
import { uploadResume } from '@/app/actions/analysis';
import { ROLE_PRESETS } from '@/lib/score/keywords/presets';
import { FileThumb } from './file-thumb';
import { Button } from '@/components/ui/button';
import { IconAlert, IconDoc, IconUpload, IconX } from '@/components/ui/icons';
import { Kbd } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { fadeUp, pick, SPRING_LAYOUT } from '@/styles/motion';

const ACCEPT = { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] };
const SAMPLES = [
  { file: 'jordan-blake.pdf', label: 'two-column PDF, weak bullets' },
  { file: 'priya-natarajan.docx', label: 'sidebar DOCX with a skills table' },
  { file: 'marcus-oyelaran.docx', label: 'clean single-column DOCX' },
];

/**
 * Full-viewport drop zone. Drag, click, or paste a file; the thumbnail renders
 * while the server parses. The card carries the shared view-transition name so
 * it morphs into the analysis panel on the next screen.
 */
export function UploadScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [roleId, setRoleId] = useState('');
  const [jdOpen, setJdOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'parsing' | 'done'>('idle');
  const router = useTransitionRouter();
  const reduced = useReducedMotion();
  const submitRef = useRef<HTMLButtonElement>(null);

  const onDrop = useCallback((accepted: File[], rejected: readonly FileRejection[]) => {
    setError(null);
    if (rejected.length) {
      const r = rejected[0];
      setError(/\.doc$/i.test(r.file.name) ? 'Legacy .doc files are not supported. Re-save as .docx in Word and try again.' : r.errors[0]?.message || 'That file type is not supported. Use PDF or DOCX.');
      return;
    }
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, accept: ACCEPT, maxFiles: 1, multiple: false, noClick: !!file, noKeyboard: true, maxSize: 8 * 1024 * 1024 });

  // Paste a file anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      const f = Array.from(e.clipboardData?.files ?? [])[0];
      if (f) {
        e.preventDefault();
        onDrop([f], []);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onDrop]);

  const submit = () => {
    if (!file) return;
    setError(null);
    setPhase('uploading');
    const fd = new FormData();
    fd.append('file', file);
    if (jd.trim()) fd.append('jd', jd.trim());
    if (roleId) fd.append('roleId', roleId);
    startTransition(async () => {
      setPhase('parsing');
      const res = await uploadResume(fd);
      if (!res.ok) {
        setPhase('idle');
        setError(res.error);
        return;
      }
      setPhase('done');
      router.push(`/analyze/${res.id}`);
    });
  };

  return (
    <div {...getRootProps({ className: cn('relative min-h-[calc(100dvh-56px)]', !file && 'cursor-pointer') })} aria-label="Resume upload area">
      <input {...getInputProps()} aria-label="Choose a resume file" />
      <AnimatePresence>
        {isDragActive ? (
          <motion.div key="drag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pointer-events-none absolute inset-3 z-20 rounded-r4 border-2 border-dashed border-accent bg-[rgba(242,179,61,0.06)]" aria-hidden>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="t-display text-2xl text-accent">Drop to scan</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="container-x grid min-h-[calc(100dvh-56px)] grid-cols-1 items-center gap-10 py-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="t-label">Upload</p>
          <h1 className="t-display mt-3 text-3xl text-fg sm:text-4xl">Drop a PDF or DOCX.</h1>
          <p className="mt-4 max-w-md text-fg-1">
            Drag it here, click anywhere, or paste it with <Kbd>⌘</Kbd>
            <Kbd>V</Kbd>. Nothing is stored beyond seven days unless you save a version.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={open} size="lg">
              <IconUpload /> Choose file
            </Button>
            <span className="num text-xs text-fg-2">PDF · DOCX · up to 8 MB</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-2" onClick={(e) => e.stopPropagation()}>
            <span>No resume handy? Try a sample:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.file}
                type="button"
                data-sample={s.file}
                onClick={async () => {
                  setError(null);
                  const res = await fetch(`/samples/${s.file}`);
                  const blob = await res.blob();
                  onDrop([new File([blob], s.file, { type: blob.type })], []);
                }}
                className="hit rounded-r1 border border-line px-2 py-1 text-fg-1 hover:border-line-strong hover:text-fg"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <label htmlFor="jd" className="t-label block">
              Target job description <span className="text-fg-3">(optional)</span>
            </label>
            <motion.textarea
              id="jd"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              onFocus={() => setJdOpen(true)}
              onBlur={() => setJdOpen(jd.trim().length > 0)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Paste the posting. Keywords, requirements and the title are read; nothing is claimed from it."
              layout
              transition={pick(reduced, SPRING_LAYOUT)}
              className={cn('mt-2 w-full resize-none rounded-r2 border border-line bg-bg-1 p-3 text-sm text-fg placeholder:text-fg-3 focus:border-line-strong', jdOpen || jd ? 'h-48' : 'h-12')}
              style={{ fontSize: 16 }}
            />
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="role" className="t-label">
                or pick a role
              </label>
              <select id="role" value={roleId} onChange={(e) => setRoleId(e.target.value)} onClick={(e) => e.stopPropagation()} className="h-9 min-w-52 rounded-r2 border border-line bg-bg-1 px-2 text-sm text-fg">
                <option value="">Infer from the resume</option>
                {ROLE_PRESETS.filter((p) => p.id !== 'general').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7" onClick={(e) => e.stopPropagation()}>
          <motion.div layout transition={pick(reduced, SPRING_LAYOUT)} className="panel mx-auto max-w-2xl p-5 sm:p-6" style={{ viewTransitionName: 'doc-panel' } as React.CSSProperties}>
            <div className="flex flex-col gap-5 sm:flex-row">
              <FileThumb file={file} width={180} />
              <div className="min-w-0 flex-1">
                {file ? (
                  <motion.div key={file.name} {...fadeUp} transition={pick(reduced, SPRING_LAYOUT)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="t-label">Ready to scan</p>
                        <p className="mt-1 truncate font-medium text-fg" title={file.name}>
                          {file.name}
                        </p>
                        <p className="num mt-0.5 text-xs text-fg-2">
                          {(file.size / 1024).toFixed(0)} KB · {/\.pdf$/i.test(file.name) ? 'PDF' : 'DOCX'}
                        </p>
                      </div>
                      <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="rounded-r1 p-1 text-fg-2 hover:text-fg">
                        <IconX />
                      </button>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="readout">
                        <dt className="t-label">target</dt>
                        <dd className="mt-1 truncate text-fg">{jd.trim() ? 'Pasted job description' : roleId ? ROLE_PRESETS.find((p) => p.id === roleId)?.label : 'Inferred from titles'}</dd>
                      </div>
                      <div className="readout">
                        <dt className="t-label">engine</dt>
                        <dd className="mt-1 text-fg">6 categories · 4 ATS profiles</dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex items-center gap-3">
                      <Button ref={submitRef} variant="primary" size="lg" onClick={submit} disabled={pending} aria-busy={pending}>
                        {phase === 'parsing' || phase === 'uploading' ? 'Parsing…' : phase === 'done' ? 'Opening…' : 'Scan this resume'}
                      </Button>
                      {pending ? <span className="num text-xs text-fg-2">Extracting text with geometry…</span> : null}
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex h-full min-h-[200px] flex-col justify-center text-fg-1">
                    <div className="flex items-center gap-2 text-fg-2">
                      <IconDoc />
                      <span className="t-label">No file yet</span>
                    </div>
                    <p className="mt-2 text-sm">The card fills in with a live render of your first page the moment a file lands. Then it becomes the analysis panel.</p>
                  </div>
                )}
                {error ? (
                  <div role="alert" className="mt-4 flex items-start gap-2 rounded-r2 border border-[rgba(229,101,79,0.35)] bg-bad-dim p-3 text-sm text-fg">
                    <IconAlert className="mt-0.5 shrink-0 text-bad" />
                    <span>{error}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
