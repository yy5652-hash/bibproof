import { useState } from 'react';
import { sanitizeUserEvidence, type UserEvidence } from '../core/userEvidence';
import { useI18n } from '../i18n';
import { SourceLink } from './Evidence';
export function UserEvidenceView({ evidence }: { evidence: UserEvidence }) {
  const { t } = useI18n();
  return <div className="user-evidence" data-testid="user-evidence">
    <strong className="tag">{t('user.badge')}</strong><p>{t('user.scope')}</p>
    <p translate="no">{evidence.url ? <SourceLink url={evidence.url}>{evidence.title}</SourceLink> : evidence.title}</p>
    <p translate="no">{[evidence.authors,evidence.year,evidence.venue].filter(Boolean).join(' · ')}</p>
    <p translate="no">{evidence.note}</p>
  </div>;
}
export function UserEvidenceForm({ evidence, onSave }: { evidence?: UserEvidence; onSave: (e?: UserEvidence) => void }) {
  const { t } = useI18n();
  const [open,setOpen] = useState(false); const [error,setError] = useState('');
  const [draft,setDraft] = useState<UserEvidence>(evidence ?? {url:'',title:'',authors:'',year:'',venue:'',note:''});
  return <section className="user-review">
    {evidence && <UserEvidenceView evidence={evidence} />}
    <button className="button small" aria-expanded={open} onClick={() => setOpen(!open)}>{t(evidence ? 'user.edit' : 'user.found')}</button>
    {open && <form className="user-form" onSubmit={ev => {
      ev.preventDefault();
      if (draft.url && !/^https?:\/\//i.test(draft.url)) { setError(t('user.invalid')); return; }
      const cleaned = sanitizeUserEvidence(draft);
      if (!cleaned || (draft.url && !cleaned.url)) { setError(t('user.invalid')); return; }
      onSave(cleaned); setError(''); setOpen(false);
    }}>
      <p>{t('user.scope')}</p>
      {(['url','title','authors','year','venue','note'] as const).map(key => <label key={key}>{t(`user.${key}`)}
        {key === 'note' ? <textarea required maxLength={2000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} />
        : <input type={key === 'url' ? 'url' : 'text'} required={key==='title'} maxLength={key==='year'?20:key==='authors'||key==='url'?600:400} value={draft[key]??''} onChange={e=>setDraft({...draft,[key]:e.target.value})} />}
      </label>)}
      <button className="button small primary" type="submit">{t('user.save')}</button>
      {evidence && <button className="button small" type="button" onClick={()=>{onSave(undefined);setOpen(false);}}>{t('user.remove')}</button>}
      {error && <p role="alert">{error}</p>}
    </form>}
  </section>;
}
