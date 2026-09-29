import { useCallback, useRef, useState } from "react";
import { UploadIcon } from "./icons";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFilesSelected, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = ""; // allow re-selecting the same file after removal
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  return (
    <div
      className={`dropzone${isDragActive ? " dropzone--active" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Upload photos"
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openFilePicker();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="dropzone__input"
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        disabled={disabled}
        onChange={handleInputChange}
      />
      <button type="button" className="dropzone__button" onClick={openFilePicker} disabled={disabled}>
        <UploadIcon />
        Upload files
      </button>
      <p className="dropzone__hint">Click to upload or drag and drop</p>
      <p className="dropzone__subhint">PNG, JPG, HEIC up to 120MB</p>
    </div>
  );
}
