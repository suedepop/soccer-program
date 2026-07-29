'use client';

import { useId, useRef, useState } from 'react';

/**
 * File picker that also accepts a drag-and-drop. Multi-select is on so a parent
 * can add a whole season's worth in one go.
 */
export default function PhotoUploadButton({
  onFiles,
  disabled,
  busy,
  label = 'Upload photos',
  full,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  /** Render as a large drop zone rather than a button. */
  full?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  }

  const control = (
    <input
      id={id}
      ref={input}
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp"
      className="visually-hidden"
      disabled={disabled}
      onChange={(e) => {
        take(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (!full) {
    return (
      <>
        {control}
        <label
          htmlFor={id}
          className="btn btn-sm btn-secondary"
          style={{ marginBottom: 0, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        >
          {busy ? 'Uploading…' : label}
        </label>
      </>
    );
  }

  return (
    <>
      {control}
      <label
        htmlFor={id}
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) take(e.dataTransfer.files);
        }}
      >
        <strong>{busy ? 'Uploading…' : label}</strong>
        <span>
          Drag photos here, or click to choose. JPG, PNG, or WEBP — straight off the phone or
          camera is ideal.
        </span>
      </label>
    </>
  );
}
