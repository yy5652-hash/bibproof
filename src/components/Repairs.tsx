import { useI18n } from '../i18n';
import { SENTENCE_CHOICES, type ManuscriptEdit, type SentenceChoice } from '../core/repairs';
export function RepairSentences({ edits, onReview }: { edits: ManuscriptEdit[]; onReview: (key: string, choice: SentenceChoice) => void }) {
  const { t } = useI18n();
  return <section className="repair-sentences" data-testid="repair-sentences">
    <h4>{t('repair.affects', { n: edits.length })}</h4>
    <p className="fine-print">{t('results.scope')}</p>
    <ul>{edits.map(e => <li key={e.key}>
      <p translate="no">{e.sentence}</p>
      {e.renumber && <p>{t('repair.numberEdit')}: [{e.old}] → {e.next === null ? t('dec.tag.remove') : `[${e.next}]`}</p>}
      {e.labelChange && <p>{e.labelChange}</p>}
      {(e.labelChange || e.renumber) && <label><input type="checkbox" checked={e.labelDone} onChange={ev=>onReview(e.key+':label',ev.target.checked?'keep':'unresolved')} />{t('repair.labelDone')}</label>}
      <label>{t('repair.action')}<select value={e.choice} onChange={ev => onReview(e.key, ev.target.value as SentenceChoice)}>
        {SENTENCE_CHOICES.map(choice => <option key={choice} value={choice}>{t(`repair.${choice}`)}</option>)}
      </select></label>
    </li>)}</ul>
    <p className="fine-print">{t('repair.manual')}</p>
  </section>;
}
