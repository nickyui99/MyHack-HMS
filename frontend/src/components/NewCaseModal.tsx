import { useState } from 'react';
import Modal from './Modal';
import { createCase } from '@/data/source';
import { useMutation } from '@/lib/useMutation';
import type { PatientCase } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (created: PatientCase) => void;
}

const URGENCY = ['routine', 'semi_urgent', 'urgent', 'emergent'] as const;

export default function NewCaseModal({ open, onClose, onCreated }: Props) {
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'male' | 'female' | ''>('');
  const [diagnosis, setDiagnosis] = useState('');
  const [payer, setPayer] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]>('routine');
  const [notes, setNotes] = useState('');

  const mut = useMutation(createCase);

  const submit = async () => {
    const created = await mut.run({
      patient_name: patientName,
      patient_age: patientAge ? Number(patientAge) : null,
      patient_gender: patientGender || null,
      diagnosis,
      case_stage: 'intake',
      payer: payer || null,
      location: location || null,
      urgency,
      clinical_context: notes ? { notes } : {},
    });
    if (created) {
      onCreated?.(created);
      onClose();
      // reset for next time
      setPatientName(''); setPatientAge(''); setPatientGender('');
      setDiagnosis(''); setPayer(''); setLocation(''); setUrgency('routine'); setNotes('');
      mut.reset();
    }
  };

  const canSubmit = patientName.trim().length > 0 && diagnosis.trim().length > 0 && !mut.loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New patient case"
      description="POST /cases — registers a new case in the matching backend."
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={mut.loading}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
            {mut.loading ? 'Creating…' : 'Create case'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Patient name *">
          <input className="field" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Encik Zainal" />
        </Field>
        <Field label="Age">
          <input className="field" type="number" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="58" />
        </Field>
        <Field label="Gender">
          <select className="field" value={patientGender} onChange={(e) => setPatientGender(e.target.value as 'male' | 'female' | '')}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Urgency">
          <select className="field" value={urgency} onChange={(e) => setUrgency(e.target.value as (typeof URGENCY)[number])}>
            {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Diagnosis *">
          <input className="field" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="NSTEMI" />
        </Field>
        <Field label="Payer / insurance">
          <input className="field" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Prudential BSN" />
        </Field>
        <Field label="Location">
          <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Klang Valley" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes / clinical context">
            <textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Onset, vitals, comorbidities…" />
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
