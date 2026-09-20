# Sprache zu Text: was bei Mistral taugt

Gemessen am 20.09.2026 mit sechs deutschen Sätzen aus dem Werkstattalltag (67 Wörter, kurze Stichworte und zwei
lange Sätze mit Fachbegriffen: Zahnriemen, Lambdasonde, Keilrippenriemen, AdBlue, Abgasrückführungsventil,
Kontrollschild). Testskripte und Rohdaten lagen im Arbeitsverzeichnis, das Verfahren steht unten.

**Einschränkung, die das Ergebnis färbt:** Die Sätze wurden mit Piper vertont, nicht von einem Menschen
gesprochen. Synthetische Sprache ist gleichmässig und damit fair im Vergleich der Modelle, aber sie trifft die
Aussprache mancher Fachwörter schlecht — ein Teil der Fehler geht darauf zurück, nicht auf das Erkennungsmodell.
Für eine belastbare Zahl müsste man dieselben Sätze selbst einsprechen.

## Zuerst die API fragen, nicht die Webseite

`GET /v1/models` liefert zu jedem Modell die Fähigkeiten. Damit ist die Zuordnung zu den Endpunkten eindeutig,
ohne Namen zu raten:

```bash
curl -s https://api.mistral.ai/v1/models -H "Authorization: Bearer $MISTRAL_API_KEY" \
  | jq -r '.data[] | select(.id|test("voxtral")) | "\(.id)\t\(.capabilities | to_entries | map(select(.value)) | map(.key) | join(", "))"'
```

| Modell | Fähigkeiten | Endpunkt |
|---|---|---|
| `voxtral-mini-latest`, `voxtral-mini-2602` | `audio_transcription` | `/v1/audio/transcriptions` |
| `voxtral-mini-realtime-*`, `voxtral-mini-transcribe-realtime-2602` | `audio_transcription_realtime` | nur Realtime-Kanal |
| `voxtral-small-latest`, `voxtral-small-2507` | `completion_chat`, `function_calling`, `audio` | `/v1/chat/completions` |
| `voxtral-mini-tts-*` | `audio_speech`, `function_calling`, `fine_tuning` | Sprachausgabe |

Die Produktnamen der Dokumentation sind keine Modell-IDs: «Voxtral Mini Transcribe 2» heisst in der API
`voxtral-mini-2602`, ein Aufruf mit `voxtral-mini-transcribe-2602` läuft in «Invalid model».

Bemerkenswert ist `voxtral-small-latest`: **Audio und Werkzeugaufrufe zusammen**. Damit liesse sich eine
Sprachnachricht direkt in einen Tool-Aufruf überführen («Ölwechsel bei 129'600 eintragen»), ohne Umweg über ein
Transkript — der interessantere Weg als Diktat ins Textfeld, aber mit dem unten beschriebenen Sprachwechsel als
offener Frage.

## Was bei Mistral wirklich geht

| Weg | Modell | Ergebnis |
|---|---|---|
| `/v1/audio/transcriptions` | `voxtral-mini-latest` | **16,4 % Wortfehler**, 3,6 s für sechs Sätze |
| `/v1/audio/transcriptions` | `voxtral-mini-2602` | identisch, 16,4 % — dasselbe Modell unter anderem Namen |
| `/v1/audio/transcriptions` | `voxtral-small-latest` | **geht nicht**: «Invalid model» |
| `/v1/chat/completions` mit `input_audio` | `voxtral-mini-latest` | **geht nicht**: «Invalid model» |
| `/v1/chat/completions` mit `input_audio` | `voxtral-small-latest` | 70,1 % Wortfehler — **kein Transkriptionsfehler**, das Modell formuliert um |
| WebSocket, Realtime | `voxtral-mini-realtime-*`, `voxtral-mini-transcribe-realtime-2602` | nur im Realtime-Kanal, am Batch-Endpunkt abgelehnt |

«Invalid model» liegt nicht am Aufruf. Am Transkriptions-Endpunkt wurden sieben Namen durchprobiert, nur
`voxtral-mini-latest` und `voxtral-mini-2602` werden angenommen; `voxtral-mini-transcribe-2602`,
`-transcribe-latest`, `voxtral-small-2507` und `voxtral-small-latest` werden abgelehnt. Im Audio-Chat wurden
beide dokumentierten Formen von `input_audio` getestet (Objekt mit `data`/`format` und reiner Base64-String) —
`voxtral-mini-*` wird in beiden Formen abgelehnt, nur `voxtral-small-latest` antwortet. Die Aufteilung ist also
fest: **mini schreibt mit, small versteht.**

Beim Wiederholungslauf antwortete `voxtral-small-latest` auf denselben deutschen Satz **auf Englisch** und
inhaltlich verdreht: «Zahnriemen mit Wasserpumpe ersetzt» wurde zu «The water pump replaced the fan belt.» Damit
ist es für Diktat und Rückmeldung endgültig raus.

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

## Ganzes Formular aus einer Ansage füllen

Gesprochen: «Rechnung von der Garage Hubmann in Rorschach vom vierzehnten September zwanzig sechsundzwanzig,
Betrag 486.50, Kilometerstand 118'400, Ölwechsel mit Ölfilter für 189 und Bremsbeläge vorne für 297.50»
(19 Sekunden). Bewertet wurden fünf Felder: Werkstatt, Datum, Betrag, Kilometerstand, Zahl der Positionen.
Drei Durchläufe je Weg, `temperature: 0`.

| Weg | Felder richtig | Zeit | Tokens | Fehler |
|---|---|---|---|---|
| **A** Audio direkt an `voxtral-small-latest` | **4,0 von 5** (dreimal gleich) | 1,7 s | 558 | «Garage Hugmann», und «Bremsbeläge» wurde zu «Bremsscheiben» |
| **B** `voxtral-mini` transkribiert, `mistral-small` ordnet zu | **5,0 von 5** (dreimal gleich) | 2,1 s | 264 | keiner |

Der zweistufige Weg gewinnt, und zwar deutlich: alle Felder richtig, halb so viele Tokens, dafür 0,4 Sekunden
langsamer. Der Grund zeigt sich im Zwischenschritt — bei dieser zusammenhängend gesprochenen Ansage war das
Transkript fast fehlerfrei («Garage Hubmann», «486,50», «118.400»), während das Audio-Modell den Eigennamen
verhörte und eine Position umbenannte. **Zusammenhängende Sätze erkennt `voxtral-mini` gut; Stichworte nicht.**

Wichtig: Es ist derselbe Weg, den die App beim Foto einer Rechnung schon geht (OCR, dann Auswertung). Eine
Ansage wäre nur eine weitere Quelle für `parseInvoice`.

## Empfehlung je Anwendungsfall

Punkte von 1 bis 5, aus den Messungen oben. «Kosten» sind Rechenkosten pro Nutzung, gerundet.

| Fall | Empfohlener Weg | Eignung | Kosten | Warum |
|---|---|---|---|---|
| **1. Langer Text: Kontakt und Rückmeldung** | Aufnahme behalten **und** `voxtral-mini` transkribieren | **5** | ~0.0015 $ je 30 s | Wortfehler stören nicht, der Sinn kommt an; die Aufnahme bleibt zum Nachhören. Läuft bereits im Rückmeldungs-Dialog |
| **2. KI-Chat** | Diktat über `voxtral-mini`, Text in die Eingabezeile, Nutzer prüft vor dem Senden | **4** | ~0.0015 $ je 30 s | Der Chat verzeiht Hörfehler, weil der Nutzer den Text vor dem Absenden sieht. Audio direkt ins Chat-Modell zu geben wäre möglich (`voxtral-small` kann `audio` + `function_calling`), schreibt aber unkontrolliert um |
| **3. Kurze Formularfelder** (Beschreibung, Notiz) | Diktat über `voxtral-mini`, Text ins Feld, Nutzer korrigiert | **3** | ~0.0005 $ je 10 s | Einzelne Fachwörter trifft es schlecht («Sahnriemen»), im Satz besser. Für Kennzeichen, Beträge und Daten **nicht** anbieten |
| **4. Ganzes Formular aus einer Ansage** | `voxtral-mini` transkribieren, dann `mistral-small` in Felder zerlegen (Weg B) | **5** | ~0.001 $ je 20 s plus ~0.0001 $ Auswertung | 5 von 5 Feldern über drei Läufe, halb so viele Tokens wie der direkte Weg. Wie beim Foto: Felder vorbelegen, Nutzer bestätigt |

Nicht empfohlen: Audio direkt an `voxtral-small` (Fall 4: 4 von 5, verhört Eigennamen), Nachkorrektur eines
Transkripts durch ein Textmodell (verschlechtert lange Sätze), Web Speech API für alles, was belegbar sein muss.

## Was daraus folgt

- **Ein Weg für alles:** `voxtral-mini-latest` transkribiert; wo Struktur gebraucht wird, zerlegt `mistral-small`
  den Text. Kein zweites Modell nötig, kein Anbieterwechsel.
- **Kennzeichen, Beträge, Daten:** einzeln nicht diktieren, tippen. In einem ganzen Satz gesprochen erkennt sie
  die Kette dagegen zuverlässig.
- Vor jeder Umstellung neu messen und **zuerst `GET /v1/models` lesen**: Die Fähigkeiten dort sagen, welches
  Modell an welchen Endpunkt gehört. `voxtral-mini-latest` zeigte im Test dasselbe Verhalten wie
  `voxtral-mini-2602`.

## Verfahren

Sechs Sätze mit Piper vertont, an jeden Kandidaten geschickt, Ausgabe gegen die Vorlage mit Levenshtein-Distanz
auf Wortebene verglichen (Wortfehlerrate). Normalisiert wurden Gross- und Kleinschreibung sowie Satzzeichen.
