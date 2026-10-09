# Sprachsystem (Deutsch + Englisch)

- `t('schluessel', { name })` übersetzt sofort (nur beim Rendern oder in Funktionen aufrufen, **nie** auf Modulebene).
- `m('schluessel', { zahl: 3 })` baut einen Text für den Spielstand, die Engine, Ereignisse, News, Buchungen. Er wird erst beim Anzeigen mit `tx(text)` übersetzt. `tx()` gibt normalen (auch alten deutschen) Text unverändert zurück.
- `tp('schluessel', n)` / `mp(...)`: Mehrzahl über `schluessel.one` und `schluessel.other`, Platzhalter `{n}`.
- Platzhalter: `{name}`, mit Format `{n:num}` `{v:dec1}` `{betrag:money}` `{betrag:moneyC}` `{betrag:moneyS}` `{anteil:pct}`. `{game}` ist der Spielname (`src/config.ts`).
- Daten mit Text: `loc('prefix', obj, ['name','desc'])`, `locList`, `lazyRecord`, `lazyArray` liefern Objekte, deren Textfelder bei jedem Zugriff übersetzt werden.
- Dateien: `src/i18n/de/<teil>.ts` und `src/i18n/en/<teil>.ts` mit denselben Schlüsseln (die englische Datei wird gegen die deutsche typgeprüft). `de.ts` / `en.ts` fügen sie zusammen.
- Prüfen: `node scripts/check-i18n.mjs`.
