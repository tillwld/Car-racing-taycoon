// Das Postfach der Managerin: Nachrichten lesen und Fragen zum Spiel stellen.
import { useEffect, useRef, useState } from 'react';
import type { Screen } from '../../App';
import { useLoadedGame } from '../store';
import { Btn, Icon } from '../components/common';
import { MANAGER, QUICK_QUESTIONS, managerAsk, managerBox, managerReply, markManagerRead } from '../../game/manager';

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

  const questions = more ? QUICK_QUESTIONS : QUICK_QUESTIONS.slice(0, SHOWN_QUESTIONS);

  return (
    <section className="chat" aria-label={`Postfach von ${MANAGER.name}`}>
      <header className="chat-head">
        <ManagerAvatar size={46} />
        <div style={{ minWidth: 0 }}>
          <b className="display" style={{ fontSize: 20 }}>{MANAGER.name}</b>
          <div className="muted" style={{ fontSize: 13 }}>Deine Managerin · beantwortet Fragen zum Spiel und warnt vor auslaufenden Verträgen</div>
        </div>
      </header>

      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {box.messages.map((m) => (
          <div key={m.id} className={`chat-row ${m.from === 'player' ? 'me' : ''}`}>
            {m.from === 'manager' && <ManagerAvatar size={30} />}
            <div className={`bubble ${m.from === 'player' ? 'me' : ''} ${m.urgent ? 'urgent' : ''}`}>
              {m.urgent && <span className="pill warn" style={{ marginBottom: 4 }}>Wichtig</span>}
              <div className="bubble-text">{m.text}</div>
              {m.actions && m.actions.length > 0 && (
                <div className="row" style={{ marginTop: 8 }}>
                  {m.actions.map((a) => (
                    <Btn key={a.screen} variant="sm" onClick={() => go(a.screen as Screen)}>{a.label}</Btn>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="chat-row">
            <ManagerAvatar size={30} />
            <div className="bubble typing" aria-label={`${MANAGER.first} schreibt`}><i /><i /><i /></div>
          </div>
        )}
      </div>

      <div className="chat-quick">
        {questions.map((q) => (
          <button key={q} type="button" className="chip" disabled={typing} onClick={() => send(q)}>{q}</button>
        ))}
        {QUICK_QUESTIONS.length > SHOWN_QUESTIONS && (
          <button type="button" className="chip ghost" onClick={() => setMore(!more)}>{more ? 'Weniger Fragen' : 'Mehr Fragen'}</button>
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
          placeholder={`Frag ${MANAGER.first} etwas zum Spiel …`}
          aria-label="Deine Frage"
          onChange={(e) => setText(e.target.value)}
          // Tasten wie W, A, S, D gehören dem Eingabefeld und lösen keine Spielaktionen aus
          onKeyDown={(e) => e.stopPropagation()}
        />
        <Btn variant="primary" type="submit" disabled={!text.trim() || typing}><Icon name="chat" /> Senden</Btn>
      </form>
    </section>
  );
}
