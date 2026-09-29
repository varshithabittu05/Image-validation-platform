import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadDropzone } from "../src/components/UploadDropzone";

function makeFile(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: "image/jpeg" });
}

describe("UploadDropzone", () => {
  it("renders the upload affordances", () => {
    render(<UploadDropzone onFilesSelected={vi.fn()} />);
    expect(screen.getByRole("button", { name: /upload files/i })).toBeInTheDocument();
    expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/png, jpg, heic up to 120mb/i)).toBeInTheDocument();
  });

  it("forwards files picked via the hidden file input", () => {
    const onFilesSelected = vi.fn();
    render(<UploadDropzone onFilesSelected={onFilesSelected} />);

    const input = screen.getByLabelText(/upload photos/i).querySelector("input") as HTMLInputElement;
    const file = makeFile("photo.jpg");
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it("clears the input value after selection so the same file can be re-picked", () => {
    render(<UploadDropzone onFilesSelected={vi.fn()} />);
    const input = screen.getByLabelText(/upload photos/i).querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("photo.jpg")] } });
    expect(input.value).toBe("");
  });

  it("forwards files dropped onto the dropzone", () => {
    const onFilesSelected = vi.fn();
    render(<UploadDropzone onFilesSelected={onFilesSelected} />);

    const dropzone = screen.getByLabelText(/upload photos/i);
    const file = makeFile("dropped.png");
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it("ignores a drop with no files instead of calling the callback with an empty array", () => {
    const onFilesSelected = vi.fn();
    render(<UploadDropzone onFilesSelected={onFilesSelected} />);

    const dropzone = screen.getByLabelText(/upload photos/i);
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });

    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it("disables the upload button when disabled is passed", () => {
    render(<UploadDropzone onFilesSelected={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /upload files/i })).toBeDisabled();
  });
});
