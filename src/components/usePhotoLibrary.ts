'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LibraryPhoto } from '@/lib/files';

/** How far along the current upload is, for something honest to show a parent. */
export interface UploadProgress {
  /** Files in this batch. */
  files: number;
  /** 0..1 of bytes sent, then held at 1 while the server resizes and stores. */
  fraction: number;
  /** True once every byte is sent and we are waiting on the server. */
  processing: boolean;
}

export interface LibraryState {
  photos: LibraryPhoto[];
  limit: number;
  loading: boolean;
  error: string | null;
  uploading: boolean;
  progress: UploadProgress | null;
  /** Uploads files and returns how many actually landed. */
  upload: (files: File[]) => Promise<number>;
  remove: (id: number) => Promise<boolean>;
  reload: () => Promise<void>;
  setError: (message: string | null) => void;
}

/**
 * Loads and mutates a photo library.
 *
 * Shared by the library page and the in-editor picker so both always show the
 * same set — uploading from inside an ad puts the photo in the library too.
 *
 * `basePath` defaults to the signed-in parent's own library. The admin screens
 * point it at `/api/admin/users/<id>/photos`, which answers in the same shape;
 * that endpoint has no DELETE, so callers using it must not offer `remove`.
 */
export function usePhotoLibrary(basePath = '/api/photos'): LibraryState {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(basePath);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not load those photos.');
      setLoading(false);
      return;
    }
    setPhotos(json.photos ?? []);
    setLimit(json.limit ?? 100);
    setLoading(false);
  }, [basePath]);

  useEffect(() => {
    reload();
  }, [reload]);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return 0;
    setUploading(true);
    setProgress({ files: files.length, fraction: 0, processing: false });
    setError(null);

    const form = new FormData();
    for (const f of files) form.append('files', f);

    /**
     * XMLHttpRequest rather than fetch, for the one thing it still does better:
     * upload progress events. A parent on a phone sending eight photos over a
     * stadium's worth of signal needs to see that something is happening, and
     * fetch cannot tell them.
     */
    const { ok, json } = await new Promise<{ ok: boolean; json: Record<string, unknown> }>(
      (resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', basePath);
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const fraction = e.loaded / e.total;
          setProgress({ files: files.length, fraction, processing: fraction >= 1 });
        };
        // Every byte is sent, but the server still has to decode, resize, and
        // write each one — which on a big batch is most of the wait.
        xhr.upload.onload = () =>
          setProgress({ files: files.length, fraction: 1, processing: true });
        xhr.onload = () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(xhr.responseText);
          } catch {
            /* handled by the ok check below */
          }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, json: parsed });
        };
        xhr.onerror = () => resolve({ ok: false, json: {} });
        xhr.ontimeout = () => resolve({ ok: false, json: {} });
        xhr.send(form);
      }
    );

    setUploading(false);
    setProgress(null);

    if (!ok) {
      setError((json.error as string) ?? 'That upload did not work.');
      return 0;
    }

    setPhotos((json.photos as LibraryPhoto[]) ?? []);
    setLimit((json.limit as number) ?? 100);

    // Partial success is normal here — report it rather than pretending.
    const notes: string[] = [];
    if (json.skipped) notes.push(`${json.skipped} skipped (library full)`);
    if (Array.isArray(json.errors)) notes.push(...(json.errors as string[]));
    setError(notes.length ? notes.join(' · ') : null);

    return (json.added as number) ?? 0;
  }, [basePath]);

  // Deleting is always the owner's own route: an admin can add to a library but
  // not clear one out, so there is no admin equivalent to point this at.
  const remove = useCallback(async (id: number) => {
    setError(null);
    const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not delete that photo.');
      return false;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, []);

  return { photos, limit, loading, error, uploading, progress, upload, remove, reload, setError };
}
