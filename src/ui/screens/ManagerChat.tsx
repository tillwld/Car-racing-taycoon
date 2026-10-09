// Das Postfach der Managerin: Nachrichten lesen und Fragen zum Spiel stellen.
import { useEffect, useRef, useState } from 'react';
import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Btn, Icon } from '../components/common';
import { MANAGER, managerAsk, managerBox, managerReply, markManagerRead, quickQuestions } from '../../game/manager';
import { t, tx, useLang } from '../../i18n';

const SHOWN_QUESTIONS = 6;

export function ManagerAvatar({ size = 40 }: { size?: number }) {
  return (
    <span className="chat-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {MANAGER.name.split(' ').map((p) => p[0]).join('')}
    </span>
  );
}

export default function ManagerChat({ go }: { go: (s: Screen) => void }) {
  const { game: g, update } = useLoadedGame();
  useLang(); // Beispielfragen und Texte neu holen, wenn die Sprache wechselt
  const box = managerBox(g);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [more, setMore] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  // Beim Öffnen und bei neuen Nachrichten: als gelesen markieren und nach unten scrollen
  useEffect(() => {
    if (box.unread > 0) update((s) => markManagerRead(s));
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [box.messages.length, box.unread, typing]);

  const send = (raw: string) => {
    const q = raw.trim();
    if (!q || typing) return;
    setText('');
    update((s) => managerAsk(s, q));
    setTyping(true);
    window.setTimeout(() => {
      update((s) => managerReply(s, q));
      if (alive.current) setTyping(false);
    }, 600 + Math.random() * 500);
  };

  const allQuestions = quickQuestions();
  const questions = more ? allQuestions : allQuestions.slice(0, SHOWN_QUESTIONS);

  return (
    <section className="chat" aria-label={t('chat.aria', { name: MANAGER.name })}>
      <header className="chat-head">
        <ManagerAvatar size={46} />
        <div style={{ minWidth: 0 }}>
          <b className="display" style={{ fontSize: 20 }}>{MANAGER.name}</b>
          <div className="muted" style={{ fontSize: 13 }}>{t('chat.subtitle')}</div>
        </div>
      </header>

      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {box.messages.map((msg) => (
          <div key={msg.id} className={`chat-row ${msg.from === 'player' ? 'me' : ''}`}>
            {msg.from === 'manager' && <ManagerAvatar size={30} />}
            <div className={`bubble ${msg.from === 'player' ? 'me' : ''} ${msg.urgent ? 'urgent' : ''}`}>
              {msg.urgent && <span className="pill warn" style={{ marginBottom: 4 }}>{t('chat.urgent')}</span>}
              <div className="bubble-text">{tx(msg.text)}</div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="row" style={{ marginTop: 8 }}>
                  {msg.actions.map((a) => (
                    <Btn key={a.screen} variant="sm" onClick={() => go(a.screen as Screen)}>{tx(a.label)}</Btn>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="chat-row">
            <ManagerAvatar size={30} />
            <div className="bubble typing" aria-label={t('chat.typing', { name: MANAGER.first })}><i /><i /><i /></div>
          </div>
        )}
      </div>

      <div className="chat-quick">
        {questions.map((q) => (
          <button key={q} type="button" className="chip" disabled={typing} onClick={() => send(q)}>{q}</button>
        ))}
        {allQuestions.length > SHOWN_QUESTIONS && (
          <button type="button" className="chip ghost" onClick={() => setMore(!more)}>{more ? t('chat.fewer') : t('chat.more')}</button>
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          type="text"
          value={text}
          maxLength={300}
          placeholder={t('chat.placeholder', { name: MANAGER.first })}
          aria-label={t('chat.questionAria')}
          onChange={(e) => setText(e.target.value)}
          // Tasten wie W, A, S, D gehören dem Eingabefeld und lösen keine Spielaktionen aus
          onKeyDown={(e) => e.stopPropagation()}
        />
        <Btn variant="primary" type="submit" disabled={!text.trim() || typing}><Icon name="chat" /> {t('chat.send')}</Btn>
      </form>
    </section>
  );
}
