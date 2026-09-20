# Sprache zu Text: was bei Mistral taugt

Gemessen am 20.09.2026 mit sechs deutschen Sätzen aus dem Werkstattalltag (67 Wörter, kurze Stichworte und zwei
lange Sätze mit Fachbegriffen: Zahnriemen, Lambdasonde, Keilrippenriemen, AdBlue, Abgasrückführungsventil,
Kontrollschild). Testskripte und Rohdaten lagen im Arbeitsverzeichnis, das Verfahren steht unten.

**Einschränkung, die das Ergebnis färbt:** Die Sätze wurden mit Piper vertont, nicht von einem Menschen
gesprochen. Synthetische Sprache ist gleichmässig und damit fair im Vergleich der Modelle, aber sie trifft die
Aussprache mancher Fachwörter schlecht — ein Teil der Fehler geht darauf zurück, nicht auf das Erkennungsmodell.
Für eine belastbare Zahl müsste man dieselben Sätze selbst einsprechen.

## Was bei Mistral wirklich geht

| Weg | Modell | Ergebnis |
|---|---|---|
| `/v1/audio/transcriptions` | `voxtral-mini-latest` | **16,4 % Wortfehler**, 3,6 s für sechs Sätze |
| `/v1/audio/transcriptions` | `voxtral-mini-2602` | identisch, 16,4 % — dasselbe Modell unter anderem Namen |
| `/v1/audio/transcriptions` | `voxtral-small-latest` | **geht nicht**: «Invalid model» |
| `/v1/chat/completions` mit `input_audio` | `voxtral-mini-latest` | **geht nicht**: «Invalid model» |
| `/v1/chat/completions` mit `input_audio` | `voxtral-small-latest` | 70,1 % Wortfehler — **kein Transkriptionsfehler**, das Modell formuliert um |
| WebSocket, Realtime | `voxtral-mini-realtime-*`, `voxtral-mini-transcribe-realtime-2602` | nur im Realtime-Kanal, am Batch-Endpunkt abgelehnt |

Die zwei Wege sind also **nicht austauschbar**: Der Transkriptions-Endpunkt gibt wieder, was gesagt wurde. Das
Audio-Chat-Modell versteht und formuliert neu — «Bremsbeläge und Bremsscheiben vorne gewechselt» wird zu «Vordere
Bremsbeläge und Bremsscheiben gewechselt». Für ein Diktat unbrauchbar, für «trag das als Wartung ein» genau
richtig.

## Fachbegriffe

Was `voxtral-mini` aus den Testsätzen machte:

| Gesprochen | Erkannt |
|---|---|
| Zahnriemen | Sahnriemen |
| Lambdasonde defekt | Lamper-Sonderdefekt |
| Zündkerzen | Zanderzen |
| AdBlue | Arglu |
| Kontrollschild SG 248 901 | Kontrollschild SG 208 und 40.901 |

Kurze Fachbegriffe trifft es schlechter als ganze Sätze — im Satz hilft der Zusammenhang. Kennzeichen und Zahlen
verhaut es zuverlässig; sie gehören nicht diktiert.

**Begriffslisten gibt es an diesem Endpunkt nicht.** Die Parameter `prompt` und `context` werden angenommen,
ändern aber nichts am Ergebnis. Auch `language=de` ändert nichts.

**Nachkorrektur durch ein Textmodell lohnt nicht.** Getestet mit `mistral-small-latest` und einer Liste von 18
Werkstattbegriffen: Bei kurzen Stichworten korrigiert es zuverlässig (1 → 0 Fehler), bei langen Sätzen
**verschlechtert** es das Ergebnis (4 → 6 Fehler), weil es Begriffe aus der Liste hineinschiebt — aus
«Kettenspanner geprüft» wurde «Zahnriemen geprüft», aus «AdBlue nachgefüllt» wurde «Motoröl nachgefüllt». In
Summe 19,4 % → 17,9 % bei 2,7 s Zusatzzeit und dem Risiko, dass aus einer Rückmeldung etwas anderes wird, als
der Kunde gesagt hat. **Nicht einsetzen.**

## Abrechnung

Die API meldet je Aufruf `prompt_audio_seconds` — abgerechnet wird nach Audiolänge, nicht nach Tokens. Für zwölf
Sekunden Audio: `{"prompt_audio_seconds":12,"audio_tokens":375}`. Die Preisseite nennt nur «speech models are per
minute»; der in mehreren Quellen genannte Satz für Voxtral Mini Transcribe liegt bei **0.003 $ pro Minute**. Auf
der Rechnung nachprüfen, sobald die ersten Aufrufe aufgelaufen sind.

Zum Einordnen: 1000 Sprachnachrichten à 30 Sekunden kosten rund **1.50 $**.

## Browser statt API: die Web Speech API

| Punkt | Stand |
|---|---|
| Verfügbarkeit | Chrome, Edge, Safari, Opera. **Firefox nicht** (nur hinter einem Flag) |
| Verarbeitung | standardmässig auf Servern des Browserherstellers (Google, Apple), nicht im Gerät |
| Ergebnis | nur Text, **keine Aufnahme** |
| Kosten | keine |

Für ein Diktat in ein Formularfeld wäre das vertretbar und gratis. Für Rückmeldungen nicht: Man bekommt einen
weiteren Empfänger in die Datenschutzerklärung, hat keinen Vertrag mit ihm, und beim Nachhören fehlt die
Aufnahme. Deshalb läuft die Sprachnachricht im Rückmeldungs-Dialog über den eigenen Proxy.

## Was daraus folgt

- **Diktat und Rückmeldung:** `voxtral-mini-latest` am Transkriptions-Endpunkt, ohne Nachkorrektur.
- **Kennzeichen, Beträge, Daten:** nicht diktieren, tippen.
- **Verstehen statt Mitschreiben** (etwa «trag den Ölwechsel bei 120 000 ein»): `voxtral-small-latest` als
  Audio-Chat — aber dann als Werkzeugaufruf, nicht als Transkript.
- Vor jeder Umstellung neu messen: Die Modellnamen ändern sich, `voxtral-mini-latest` zeigte im Test dasselbe
  Verhalten wie `voxtral-mini-2602`.

## Verfahren

Sechs Sätze mit Piper vertont, an jeden Kandidaten geschickt, Ausgabe gegen die Vorlage mit Levenshtein-Distanz
auf Wortebene verglichen (Wortfehlerrate). Normalisiert wurden Gross- und Kleinschreibung sowie Satzzeichen.
