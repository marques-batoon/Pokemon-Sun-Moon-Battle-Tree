import { useState } from 'react';
import { checkTrainerName, TRAINER_NAME_MAX } from '../../online/trainer-name';
import { getSettingsStore } from '../services';
import { useAppSettings } from '../useAppSettings';

/**
 * Pick or change your trainer name (Settings). Shown in battle, and to the other
 * player in online Multi Battles. Saved only when it passes checkTrainerName.
 */
export function TrainerNameField({ onSaved }: { onSaved?: (name: string) => void }) {
  const { trainerName } = useAppSettings();
  const [draft, setDraft] = useState(trainerName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = () => {
    const check = checkTrainerName(draft);
    if (!check.ok) { setError(check.error); setSaved(false); return; }
    getSettingsStore().update({ trainerName: check.name });
    setDraft(check.name);
    setError(null);
    setSaved(true);
    onSaved?.(check.name);
  };
  return (
    <form className="trainer-name" onSubmit={e => { e.preventDefault(); save(); }}>
      <label className="fld">
        <span>Trainer name</span>
        <input
          value={draft}
          maxLength={TRAINER_NAME_MAX + 4}
          autoComplete="nickname"
          spellCheck={false}
          placeholder="Player"
          onChange={e => { setDraft(e.target.value); setSaved(false); setError(null); }}
          aria-invalid={!!error}
        />
      </label>
      <button type="submit" disabled={draft.trim() === trainerName}>Save</button>
      {error && <p className="problems" role="alert">{error}</p>}
      {saved && !error && <p className="muted small" role="status">Saved.</p>}
    </form>
  );
}
