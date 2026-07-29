'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LibraryPhoto } from '@/lib/files';

export interface LibraryState {
  photos: LibraryPhoto[];
  limit: number;
  loading: boolean;
  error: string | null;
  uploading: boolean;
  /** Uploads files and returns how many actually landed. */
  upload: (files: File[]) => Promise<number>;
  remove: (id: number) => Promise<boolean>;
  reload: () => Promise<void>;
  setError: (message: string | null) => void;
}

/**
 * Loads and mutates the signed-in parent's photo library.
 *
 * Shared by the library page and the in-editor picker so both always show the
 * same set — uploading from inside an ad puts the photo in the library too.
 */
export function usePhotoLibrary(): LibraryState {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/photos');
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not load your photos.');
      setLoading(false);
      return;
    }
    setPhotos(json.photos ?? []);
    setLimit(json.limit ?? 100);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return 0;
    setUploading(true);
    setError(null);

    const form = new FormData();
    for (const f of files) form.append('files', f);

    const res = await fetch('/api/photos', { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);

    if (!res.ok) {
      setError(json.error ?? 'That upload did not work.');
      return 0;
    }

    setPhotos(json.photos ?? []);
    setLimit(json.limit ?? 100);

    // Partial success is normal here — report it rather than pretending.
    const notes: string[] = [];
    if (json.skipped) notes.push(`${json.skipped} skipped (library full)`);
    if (json.errors?.length) notes.push(...json.errors);
    setError(notes.length ? notes.join(' · ') : null);

    return json.added ?? 0;
  }, []);

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

  return { photos, limit, loading, error, uploading, upload, remove, reload, setError };
}
