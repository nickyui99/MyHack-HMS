import { useState } from 'react';
import Modal from './Modal';
import { createActor } from '@/data/source';
import { useMutation } from '@/lib/useMutation';
import type { Actor } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (created: Actor) => void;
}

const ROLES = [
  'gp',
  'cardiologist',
  'cardiothoracic_surgeon',
  'anaesthetist',
  'perfusionist',
  'scrub_nurse',
  'physiotherapist',
  'dietitian',
  'pharmacist',
  'coordinator',
] as const;

const CAPACITY = ['available', 'limited', 'unavailable'] as const;

function parseChips(s: string): string[] {
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

export default function NewActorModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('cardiologist');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState('');
  const [location, setLocation] = useState('');
  const [apcNumber, setApcNumber] = useState('');
  const [apcExpiry, setApcExpiry] = useState('');
  const [panels, setPanels] = useState('');
  const [languages, setLanguages] = useState('');
  const [capacity, setCapacity] = useState<(typeof CAPACITY)[number]>('available');
  const [profile, setProfile] = useState('');

  const mut = useMutation(createActor);

  const submit = async () => {
    const created = await mut.run({
      actor_type: 'individual',
      name,
      role,
      specialty: specialty || null,
      hospital: hospital || null,
      location: location || null,
      apc_number: apcNumber || null,
      apc_expiry_date: apcExpiry || null,
      insurance_panels: parseChips(panels),
      languages: parseChips(languages),
      capacity_status: capacity,
      outcome_weight: 0.5,
      profile_text: profile || null,
      credentials: {},
    });
    if (created) {
      onCreated?.(created);
      onClose();
      setName(''); setSpecialty(''); setHospital(''); setLocation('');
      setApcNumber(''); setApcExpiry(''); setPanels(''); setLanguages('');
      setCapacity('available'); setProfile(''); mut.reset();
    }
  };

  const canSubmit = name.trim().length > 0 && !mut.loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register clinician"
      description="POST /actors — adds a healthcare professional to the matching directory."
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={mut.loading}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
            {mut.loading ? 'Creating…' : 'Create clinician'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name *">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr Aisha Rahman" />
        </Field>
        <Field label="Role">
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Specialty">
          <input className="field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Interventional cardiology" />
        </Field>
        <Field label="Hospital">
          <input className="field" value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="IJN" />
        </Field>
        <Field label="Location">
          <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Klang Valley" />
        </Field>
        <Field label="Capacity">
          <select className="field" value={capacity} onChange={(e) => setCapacity(e.target.value as (typeof CAPACITY)[number])}>
            {CAPACITY.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="APC number">
          <input className="field" value={apcNumber} onChange={(e) => setApcNumber(e.target.value)} placeholder="APC-12345" />
        </Field>
        <Field label="APC expiry">
          <input className="field" type="date" value={apcExpiry} onChange={(e) => setApcExpiry(e.target.value)} />
        </Field>
        <Field label="Insurance panels (comma-separated)">
          <input className="field" value={panels} onChange={(e) => setPanels(e.target.value)} placeholder="Prudential BSN, AIA" />
        </Field>
        <Field label="Languages (comma-separated)">
          <input className="field" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Malay" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Profile / bio">
            <textarea className="field" rows={3} value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="Brief professional summary…" />
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
