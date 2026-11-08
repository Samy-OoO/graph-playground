import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './ui/Button';
import styles from './WeightDialog.module.css';

interface WeightDialogProps {
  open: boolean;
  onSubmit: (weight: number) => void;
  onCancel: () => void;
}

/** Asks for an edge weight. Replaces window.prompt, which blocks the page and can't be styled. */
export function WeightDialog({ open, onSubmit, onCancel }: WeightDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="weight-dialog-title"
      onCancel={(event) => {
        event.preventDefault(); // we close it ourselves, via `open`
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel(); // click on the backdrop
      }}
    >
      {/* Mounted only while open, so the field starts at 1 every time. */}
      {open && <WeightForm onSubmit={onSubmit} onCancel={onCancel} />}
    </dialog>
  );
}

function WeightForm({ onSubmit, onCancel }: Omit<WeightDialogProps, 'open'>) {
  const [value, setValue] = useState('1');
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const weight = Number(value);
    if (value.trim() === '' || !Number.isFinite(weight)) {
      setError('Enter a number, for example 4 or 2.5.');
      return;
    }
    onSubmit(weight);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 id="weight-dialog-title" className={styles.title}>
        Edge weight
      </h2>
      <input
        className={styles.input}
        type="number"
        step="any"
        inputMode="decimal"
        value={value}
        aria-label="Edge weight"
        aria-invalid={error !== ''}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setValue(event.target.value);
          setError('');
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          Add edge
        </Button>
      </div>
    </form>
  );
}
