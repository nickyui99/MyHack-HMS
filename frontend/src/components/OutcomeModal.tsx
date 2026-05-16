import { useState } from 'react';
import Modal from './Modal';
import { createOutcome } from '@/data/source';
import { useMutation } from '@/lib/useMutation';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string;
  relationshipId: string;
  onRecorded?: () => void;
}

function parseChips(s: string): string[] {
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

export default function OutcomeModal({ open, onClose, caseId, relationshipId, onRecorded }: Props) {
  const [scoreSurgical, setScoreSurgical] = useState('');
  const [scoreRecovery, setScoreRecovery] = useState('');
  const [complications, setComplications] = useState('');
  const [notes, setNotes] = useState('');

  const mut = useMutation(createOutcome);

  const submit = async () => {
    const result = await mut.run({
      case_id: caseId,
      relationship_id: relationshipId,
      score_surgical: scoreSurgical ? Number(scoreSurgical) : undefined,
      score_recovery: scoreRecovery ? Number(scoreRecovery) : undefined,
      complications: parseChips(complications),
      notes: notes || undefined,
    });
    if (result) {
      onRecorded?.();
      onClose();
      setScoreSurgical(''); setScoreRecovery(''); setComplications(''); setNotes('');
      mut.reset();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record outcome"
      description={`POST /outcomes for relationship ${relationshipId.slice(0, 8)}… (transitions state to completed)`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={mut.loading}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={mut.loading}>
            {mut.loading ? 'Recording…' : 'Record outcome'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Surgical score (0–5)">
          <input className="field" type="number" min="0" max="5" step="0.1"
                 value={scoreSurgical} onChange={(e) => setScoreSurgical(e.target.value)} placeholder="4.6" />
        </Field>
        <Field label="Recovery score (0–5)">
          <input className="field" type="number" min="0" max="5" step="0.1"
                 value={scoreRecovery} onChange={(e) => setScoreRecovery(e.target.value)} placeholder="4.2" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Complications (comma-separated)">
            <input className="field" value={complications} onChange={(e) => setComplications(e.target.value)}
                   placeholder="atelectasis, mild AKI" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Clinical outcome summary…" />
          </Field>
        </div>
      </div>
      {mut.error && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          {mut.error.message}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}
