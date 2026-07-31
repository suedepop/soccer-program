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

  /**
   * Two controls over one input, and CSS decides which is on screen.
   *
   * There is nothing to drag on a phone, and a dashed rectangle saying "drag
   * photos here" is an instruction a parent cannot follow. They get a plain
   * green button that opens the camera roll; the drop zone is for the people
   * who actually have a mouse and a folder of photos.
   */
  return (
    <>
      {control}

      <label
        htmlFor={id}
        className="btn btn-go btn-lg upload-cta"
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      >
        <CameraIcon />
        {busy ? 'Uploading…' : 'Choose photos'}
      </label>

      <label
        htmlFor={id}
        className={`dropzone upload-dropzone${dragging ? ' dropzone-active' : ''}`}
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

function CameraIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .83-.45l.74-1.1A1 1 0 0 1 10.1 4h3.8a1 1 0 0 1 .83.45l.74 1.1a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
