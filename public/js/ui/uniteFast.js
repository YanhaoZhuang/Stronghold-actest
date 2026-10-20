// Native match control: declarative gameplay rules only, no UI-plugin write capability.
import { useState } from '../../vendor/hooks.module.js';
import { html } from './components.js';
import { t } from '../../../shared/i18n.js';

export function UniteFast({ state, myId, onVote, connected = true }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!state) return null;
  const eligible = state.eligible.includes(myId);
  const agreed = state.votes.includes(myId);
  const waiting = state.status === 'waiting';
  const vote = async () => {
    setBusy(true);
    setError(false);
    try { await onVote({ round: state.round, phaseId: state.phaseId, agree: !agreed }); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return html`<div class="unite-fast" aria-live="polite">
    <span>${state.status === 'running' ? t('正在快速结算') : state.status === 'complete' ? t('联防已结算')
      : t('已同意 {n}/{total}', { n: state.votes.length, total: state.eligible.length })}</span>
    ${waiting && eligible ? html`<button type="button" disabled=${busy || !connected} onClick=${vote}
      title=${t('全体真人协防者同意后，按原规则模拟至结束')}>${agreed ? t('撤回同意') : t('快进联防')}</button>` : null}
    ${waiting && state.failed ? html`<small>${t('快速结算失败，已恢复正常战斗')}</small>` : null}
    ${error ? html`<small>${t('请求失败，请重试')}</small>` : null}
  </div>`;
}
