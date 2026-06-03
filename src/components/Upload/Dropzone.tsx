import { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import { useSweepStore } from '../../store/useSweepStore';

export function Dropzone() {
  const addFiles = useSweepStore((s) => s.addFiles);
  const parsing = useSweepStore((s) => s.parsing);
  const folderRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) void addFiles(accepted);
    },
    [addFiles],
  );

  const onFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void addFiles(files);
    e.target.value = '';
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={clsx(
          'cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
          isDragActive ? 'border-brand-500 bg-brand-50' : 'border-ink-300 bg-white hover:border-brand-400',
        )}
      >
        <input {...getInputProps()} />
        <div className="text-sm font-medium text-ink-700">
          {parsing ? 'Parsing…' : isDragActive ? 'Drop the .xlsx sweeps' : 'Drop perf sweeps here'}
        </div>
        <div className="mt-1 text-xs text-ink-500">
          One or many <code className="rounded bg-ink-100 px-1">.xlsx</code> files. Parsed in your browser — nothing is uploaded.
        </div>
      </div>
      {/*
        The folder picker lives OUTSIDE the dropzone root: react-dropzone composes its
        open-dialog handler off defaultPrevented (not propagation), so nesting this button
        inside the root opened both the folder picker and the file picker.
        webkitdirectory lets a user select an entire unzipped sweep folder.
      */}
      <button
        type="button"
        onClick={() => folderRef.current?.click()}
        className="mt-2 block w-full text-center text-xs font-medium text-brand-600 underline-offset-2 hover:underline"
      >
        …or pick an entire sweep folder
      </button>
      {/* @ts-expect-error non-standard but widely supported directory upload */}
      <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={onFolderPick} />
    </div>
  );
}
