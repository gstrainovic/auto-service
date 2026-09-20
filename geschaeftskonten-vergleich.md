# Geschäftskonten Schweiz: Vergleich für Freelancing und wartungsheft.ch

## Entscheid: PostFinance Geschäftskonto

Gewählt für Freelancing ohne Handelsregistereintrag und für die QR-Zahlungseingänge von wartungsheft.ch. Die Gründe im Einzelnen stehen unten, kurz:

- Die einzige Bank, die ein Geschäftskonto ohne HR-Eintrag ausdrücklich bestätigt.
- Öffentliche ISO-20022-Testplattform, Registrierung ohne Kundenbeziehung. Der camt.054-Parser lässt sich fertig bauen und testen, bevor das Konto existiert.
- EBICS gratis in Version 3.0 und 2.5. Mit 2.5 läuft der reife Node-Client, was zum TypeScript-Stack passt.
- CHF 5 im Monat, mit dem Startangebot bei Eröffnung bis 30.11.2026 zwei Jahre gratis.

Zweitwahl bleibt die SGKB, falls das Konto ohne HR-Eintrag bei PostFinance scheitert oder eine Bank vor Ort gewünscht ist.

Der Rest dieses Dokuments ist die Begründung: der Marktvergleich, die technische Prüfung von camt.054 und der Vergleich der beiden Finalistinnen aus Entwicklersicht.

## Grundlagen des Vergleichs

Stand: 20.09.2026. Quellen sind die Websites, Preislisten und Hilfeseiten der Anbieter, dazu der Firmenkonto-Vergleich von moneyland.ch (Profil «Selbständigerwerbend», «Wenignutzer Inland»). «unklar» heisst: auf der Anbieter-Website nicht belegt, direkt bei der Bank nachfragen.

## Legende

- **Freelancing**: Konto für eine Einzelfirma **ohne** Handelsregistereintrag (HR) möglich? «nicht publiziert» heisst: Produktseiten, Antragsformulare, Checklisten, FAQ und Gründungsseiten durchsucht, keine Aussage gefunden. Klärt nur eine Anfrage bei der Bank (Telefonnummern unter «Offene Fragen»).
- **QR-Einnahmen**: QR-IBAN für QR-Rechnungen mit QR-Referenz (QRR) und automatischem Abgleich über camt.054. Jede echte CH-IBAN kann QR-Rechnungen mit normaler IBAN (SCOR-Referenz oder ohne Referenz) empfangen; die QR-IBAN braucht es nur für die QR-Referenz.
- **CH-IBAN**: eigene Schweizer IBAN auf deinen Namen, virtuelle oder geteilte IBAN, oder gar keine CH-IBAN.
- **Anbindung**: bexio, AbaNinja (Swiss21) und **EBICS**. Über EBICS holt eigene Software camt.053/054 direkt bei der Bank ab (siehe Abschnitt «Eigene Software für QR-Zahlungseingänge»).
- **Pflichtkriterium EBICS**: Konten ohne belegtes EBICS stehen unter «Abgelehnt».
- **Einzahlungen am Postschalter**: Zahlt ein Kunde eine QR-Rechnung bar am Postschalter, trägt der Kontoinhaber die Gebühr (PostFinance CHF 1.20–3.95 pro Zahlung, andere Banken geben die Postgebühr weiter). Betrifft nur Bareinzahlungen, nicht elektronische Eingänge.
- **Pflichtkriterium EBICS-Einrichtung ohne Aufwandgebühr**: Banken, die die EBICS-Einrichtung «nach Aufwand» verrechnen, stehen unter «Abgelehnt».
- **Pflichtkriterium gratis Zahlungseingänge**: QR-Einnahmen dürfen nichts kosten, unabhängig von der Menge. Konten mit Gebühr pro Zahlungseingang stehen unter «Abgelehnt», auch wenn ein Freikontingent gilt.
- **Grundgebühr**: Kontoführung laut Preisliste der Bank.
- **moneyland/J**: Gesamtkosten pro Jahr laut moneyland für das Profil «Selbständigerwerbend, Wenignutzer Inland». Enthält Kontoführung, Debitkarte, Zahlungsverkehr, **Monatsauszüge per Post** (CHF 12–54) und **Bargeldbezüge an Fremdbankomaten** (CHF 12). Wer E-Dokumente nutzt und kein Bargeld bezieht, zahlt den Betrag in Klammern («digital»). Die Kontoführung bei moneyland deckt sich bei allen 13 Konten mit der Preisliste der Bank.

## Kandidaten

| Konto | Grundgebühr (Bank) | moneyland/J (digital) | Freelancing (ohne HR) | QR-Einnahmen (QR-IBAN) | CH-IBAN | Anbindung | Region (Sitz Steinach SG) | Wertung |
|---|---|---|---|---|---|---|---|---|
| **SGKB Kontokorrent** (St.Galler KB) | CHF 5/Mt. Inlandzahlungen per E-Banking und alle Zahlungseingänge gratis.  | nicht bei moneyland | nicht publiziert. Online-Eröffnung bietet Rechtsform «Einzelfirma» und Phase «in Gründung» zur Auswahl. Kontokorrent «für … selbständig Erwerbende» | ja, im E-Banking unter «Kontoinformationen» | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis (pain, camt), Voraussetzung nur SGKB-Konto und EBICS-fähige Software. **Online-Eröffnung mit Video-Identifikation** | ja: «nur für Unternehmen mit Domizil in unserem Marktgebiet (Kantone SG und AR)» | ok |
| **PostFinance Geschäftskonto** | CHF 5/Mt. Zahlungseingänge und -ausgänge gratis bis 60'000 pro Jahr (zusammen), danach CHF 0.12. camt.054 gratis | 138 (90): Karte 30, Bargeld 12 | **ja, bestätigt** (Konto lautet auf Vor- und Nachname) | ja (als «virtuelles Konto», camt.054 auf Anfrage) | ja, eigene | bexio ja, AbaNinja ja, EBICS 3.0/2.5 gratis | schweizweit | ok |

## Abgelehnt

| Konto | Grundgebühr (Bank) | moneyland/J (digital) | Freelancing (ohne HR) | QR-Einnahmen (QR-IBAN) | CH-IBAN | Anbindung | Grund |
|---|---|---|---|---|---|---|---|
| **Zuger KB Kontokorrent** | CHF 6/Mt. «Zahlungseingang kostenlos», Buchungen mit E-Banking-Zugang gratis | 156 (112): Karte 40, Post 32, Bargeld 12 | nicht publiziert. Online-Formular in Schritt 1–2 ohne HR-Frage, ab Schritt 3 nicht geprüft | ja | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis, keine Mindestgrösse, Verbindungsparameter publiziert. EBICS-Einrichtung über Berater oder 041 709 12 12 | kein Vorteil gegenüber SGKB: CHF 1/Mt. teurer, Marktgebiet Zug statt SG, keine Online-Eröffnung geprüft, keine Testumgebung. Gleiche Leistung, schlechtere Passung |
| **ZKB Firmenkonto** | CHF 7/Mt. KMU-Package im 1. Jahr gratis. QR-Eingänge (QRR/SCOR) mit camt gratis, 600 Transaktionen pro Monat gratis | 148 (124): Karte 40, Bargeld 12 | nicht publiziert. Die Online-Eröffnung übernimmt als ersten Schritt die Firmendaten aus dem HR, was ohne Eintrag passiert, ist ungetestet | ja, gratis | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis (camt.052/053/054), keine Mindestgrösse, Einzelunterschrift. EBICS-Vertrag nur per Telefon | kein Vorteil gegenüber SGKB: CHF 2/Mt. teurer, Kontingent 600 Transaktionen pro Monat, EBICS-Vertrag nur telefonisch, Online-Eröffnung ohne HR-Eintrag ungetestet, Marktgebiet «in erster Linie Wirtschaftsraum Zürich». Einziges Plus wäre das Gratisjahr (einmalig CHF 84) |
| **Bank WIR Business pro** | CHF 9/Mt., 150 Buchungen pro Quartal inkl., Debit Mastercard optional 40/J. Zweitkonto CHF 4.50/Mt. | nicht bei moneyland | Einzelunternehmen im Online-Onboarding zugelassen, HR-Eintrag dort nicht verlangt. Aber Kriterium «operativ tätig (eigenes Personal und eigene Geschäftsräumlichkeiten)» | ja (QR-Rechnung mit IBAN oder mit QR-IBAN und QR-Referenz, QR-Zahlteile gratis im E-Banking) | ja, eigene | bexio ja (Partnerangebot 30 % Rabatt im 1. Jahr), AbaNinja ja. EBICS unklar. **Voll online eröffnen** möglich | Bank WIR und CHW-Netzwerk zielen auf lokale, nicht digitale KMU, passt nicht zu Freelancing und Online-Diensten |
| **UBS Kontokorrent Unternehmen** | CHF 20/Quartal, 1. Jahr gratis | 152 (128): Karte 48, Post 12, Bargeld 12. Gratisjahr nicht eingerechnet | widersprüchlich (wirbt für Einzelfirmen, verlangt aber HR-Eintrag) | ja (QR-Portal, camt.054) | ja, eigene | bexio ja (erweiterte Integration), AbaNinja ja, EBICS (KeyPort, für mittlere und grosse Firmen). **Voll online eröffnen per App** möglich | kein risiko wegen HR eingehen |
| **Bank Cler Kontokorrent** | CHF 5/Mt. (mit E-Set CHF 2) + 0.40/Buchung, E-Banking-Buchungen gratis | 122 (110): Karte 50, Post 12 | nicht publiziert | ja | ja, eigene | bexio **nein**, AbaNinja ja, EBICS gratis (camt.052/053/054), keine Mindestgrösse, vorher Gespräch mit der Bank | Cler führt Geschäftskonten nur noch für Immobilienkunden (Wohnbaugenossenschaften, Immobiliengesellschaften), Aufnahme einer Einzelfirma fraglich |
| **AKB (Aargauische KB)** | keine Grundgebühr | 40 (0): Karte 0, Post 28, Bargeld 12 | nicht publiziert. Eröffnung nur über Kontaktformular mit Rückruf. Einziger Hinweis: Der Firmenkreditkarten-Antrag erlaubt «HR-Eintrag: Nein, Firmengründung» | vermutlich ja (camt.054 für QR-Referenz im EBICS-Factsheet) | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis, keine Mindestgrösse | nur für Kunden im Kanton Aargau und Region, Sitz ist Steinach SG |
| **Raiffeisenbank Regio Arbon** | CHF 60/J + CHF 0.15 pro Zahlungseingang und -ausgang im Inland (bis 60 pro Quartal). Mitglieder-Kontokorrent gratis, braucht einen Anteilschein (Preis nicht publiziert) | moneyland (Raiffeisen allgemein): 166.50 (118.50) | nicht publiziert. Einzelunternehmer ausdrücklich Zielgruppe, Anfrageformular ohne HR-Feld | ja, mehrere QR-IBAN pro Konto möglich | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis, EBICS-Vertrag und Nutzungsvertrag «Raiffeisen Business Banking» nötig. Geschäftsstelle in Steinach | Gebühr auf jeden Zahlungseingang, QR-Einnahmen müssen gratis sein |
| **TKB Kontokorrent** (Thurgauer KB) | Kontoführung gratis, CHF 0.20 pro Buchung. Paket Business Classic CHF 48/J (25 % Rabatt auf Buchungen) | nicht bei moneyland | wahrscheinlich ja. Formular fragt «Handelsregistereintrag vorhanden» ab | ja, über Beratung | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis, Einrichtung «je nach Aufwand» | «Buchungsgebühr CHF –.20 pro Buchung», Gutschriften nicht ausgenommen. EBICS-Einrichtung «je nach Aufwand» |
| **acrevis Business XS** | CHF 24/J, 6 Buchungen pro Quartal inklusive, danach CHF 0.30 | nicht bei moneyland | nicht publiziert | ja | ja, eigene | bexio ja, AbaNinja ja, EBICS individuell verrechnet | ab der 7. Buchung im Quartal CHF 0.30, Gutschriften nicht ausgenommen. EBICS «individuelle Verrechnung», Einrichtung «nach Aufwand» |
| **Valiant Business Set Basis** | gratis, 60 Buchungen/J inklusive, danach CHF 0.25 (Sammelbuchung zählt als eine) | 156.50 (120.50) für das Kontokorrent, Set fehlt bei moneyland | nicht publiziert. Konto «für alle selbstständig Erwerbenden», Antragsformular ohne HR-Feld | ja, gratis | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis (nur mit VEU), beworben für «grössere Unternehmen» | ab der 61. Buchung im Jahr CHF 0.25, Gutschriften nicht ausgenommen |
| **BEKB Kontokorrent Firmen** | keine Grundgebühr, CHF 0.35 pro Buchung. KMU-Paket CHF 15/Mt. mit 150 Buchungen pro Quartal | 147 (81) | nicht publiziert, aber wahrscheinlich (Selbständigerwerbende Zielgruppe, Formulare ohne HR-Feld) | ja, gratis | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis | CHF 0.35 pro Buchung, Gutschriften nicht ausgenommen. Region: Hauptmarkt Kanton Bern |
| **FKB (Freiburger KB)** | CHF 2.67/Mt. + 0.50/Buchung, Selbständigen-Paket CHF 72/J | 159 (107) | nicht publiziert | ja | ja, eigene | bexio ja, AbaNinja ja, EBICS gratis | «CHF 0.50 Buchungsspesen für alle ein- oder ausgehenden e-banking-Zahlungen». Region: Paket «speziell für Selbstständige im Kanton Freiburg» |
| **Hypothekarbank Lenzburg** | CHF 2/Mt. + 1.10 pro Buchungstag, Debitkarte 30/J | nicht bei moneyland | nicht publiziert | ja | ja, eigene | bexio ja, AbaNinja nicht in der Liste, EBICS gratis | Eingang selbst gratis, aber CHF 1.10 pro Buchungstag, Tage nur mit Eingängen nicht ausgenommen. Region: Formular bietet nur Geschäftsstellen im Aargau |
| **Appenzeller KB Servicekonto** | CHF 12/J, gedacht für «Selbstständigerwerbende und Vereine». Kontokorrent CHF 7 pro Quartal | nicht bei moneyland | nicht publiziert | ja, laut Factsheet | ja, eigene | bexio **nein**, AbaNinja ja, EBICS (pain, camt), Kosten nicht publiziert. Eröffnung nur mit Termin | Risiko: Zahlungseingänge nicht ausdrücklich gratis, EBICS-Kosten nicht publiziert. Einziger Vorteil CHF 48/J günstiger als SGKB, dafür kein bexio, keine Online-Eröffnung, Region Appenzell I.Rh. |
| **Migros Bank Kontokorrent** | CHF 3/Mt. | 66 (36): Karte 0, Post 18, Bargeld 12 | wahrscheinlich ja (HR-Auszug nur «sofern eingetragen») | ja | ja, eigene | bexio nein, AbaNinja ja. camt.053/054 nur als manueller Export | EBICS nicht belegt |
| **Alternative Bank Schweiz** | CHF 5/Mt. + 0.10/Buchung | 119 (107): Karte 40, Post 12, Zahlungen 7 | vorgesehen (eigenes «Konto für Einzelunternehmen», Formular fragt HR ja/nein). Nur für «werteverwandte» Firmen | ja, 500 QR-Belege pro Jahr gratis | ja, eigene | bexio ja, AbaNinja ja | EBICS nicht belegt |
| **Yapeal** | Free CHF 0, Essential CHF 9, Grow CHF 49/Mt. | nicht bei moneyland | **nein**, nur mit HR-Eintrag | unklar (nur Bezahlen belegt) | ja, eigene (letzte 12 Zeichen wählbar) | Abacus ja, camt.053-Download. bexio nein, AbaNinja nicht in der Liste | kein EBICS, verlangt HR-Eintrag |
| **Revolut Business** | Basic CHF 10, Grow CHF 50/Mt. | nicht bei moneyland | **nein**, nur mit Registereintrag | **nein** (Empfang per QR-Code ausdrücklich nicht unterstützt) | virtuell, Inhaberin Revolut Bank UAB, Referenz nötig | Business API ab Grow (CHF 50/Mt.), camt.053. Xero, QuickBooks, Zapier. bexio nur per CSV-Import, AbaNinja nein | kein EBICS, verlangt Registereintrag, kein QR-Empfang |
| **Revolut Pro** | unklar | nicht bei moneyland | vorgesehen für nicht eingetragene Einzelunternehmer | unklar | unklar | Verfügbarkeit in der Schweiz unklar: die CH-Hilfe empfiehlt Pro, die CH-Produktseiten liefern aber 404 | kein EBICS, Verfügbarkeit in CH unklar |
| **Wise Business** | einmalig CHF 55, keine Monatsgebühr | nicht bei moneyland | unklar (Freelancer erlaubt, braucht aber einen Registrierungsnachweis) | nein | **keine CH-IBAN** (CHF nur per Swift) | Xero, QuickBooks, camt.053. bexio nein | kein EBICS, keine CH-IBAN |
| **Swissquote** | keine Kontoführungsgebühr gelistet | nicht bei moneyland | unklar | unklar | ja | unklar | EBICS nicht belegt |
| **Relio** | Preis auf Anfrage | nicht bei moneyland | unklar | unklar | ja | unklar | EBICS nicht belegt |

## Nicht geeignet

- **Yuh**: nur privat, Zahlungen für berufliche Leistungen sind verboten. Ein «Yuh Pro» gibt es nicht.
- **neon**: nur privat, «also applies to freelancers». Ein «neon Business» gibt es nicht.
- **Zak (Bank Cler)**: nur für natürliche Personen. Die Geschäftskonten von Bank Cler stehen unter «Abgelehnt».
- **radicant**: Geschäftstätigkeit eingestellt.

Damit bleiben zwei Kandidatinnen: PostFinance und SGKB.

## Einschätzung für Freelancing ohne HR-Eintrag und wartungsheft.ch

1. **PostFinance Geschäftskonto, gewählt**: die einzige Bank, die ein Konto ohne HR-Eintrag ausdrücklich bestätigt. EBICS gratis in 3.0 und 2.5, QR-IBAN, bexio und AbaNinja. Mit dem Startangebot 2 Jahre gratis. Aus Entwicklersicht die stärkere Wahl, siehe «SGKB gegen PostFinance aus Entwicklersicht».
2. **SGKB Kontokorrent, Zweitwahl**: die Kantonalbank für Steinach. CHF 5/Mt., EBICS gratis, QR-IBAN, bexio und AbaNinja. Online-Eröffnung mit den Optionen «Einzelfirma» und «in Gründung». Konto ohne HR-Eintrag bestätigen lassen.

Zu prüfen: PostFinance (60'000 Transaktionen pro Jahr gratis, danach CHF 0.12) hat formal ein Kontingent, allerdings weit über dem Bedarf einer Einzelfirma.

Rein digital genutzt (E-Dokumente, kein Bargeld) kosten die meisten Konten CHF 80–130 pro Jahr. Die Unterschiede bei moneyland entstehen vor allem durch Papierauszüge und Debitkarten-Gebühren.

Bei wartungsheft.ch zahlen Privatkunden über Stripe, Betriebe per Jahresrechnung mit QR-Zahlteil (ai-proxy `src/invoice.ts`). Für Stripe ist die Stripe-API die Schnittstelle, das Bankkonto empfängt nur die Auszahlungen. Für die Jahresrechnungen zählt der Zahlungsabgleich über camt.054, siehe «SGKB: Eignung für den eigenen Zahlungsabgleich».

## camt.054: Felder für den eigenen Zahlungsabgleich

Belegt am Handbuch der SGKB, weil es die Felder vollständig und aktuell dokumentiert: «Technische Spezifikationen von Kunde-Bank-Meldungen (Reports)», ISO 20022 Version 2019, gültig ab 15.08.2025, Kopie in `sgkb-cash-management-handbuch.pdf`. Kontakt für Fragen: iso20022@sgkb.ch (Team Open Banking).

Die Feldbelegung stammt aus den Swiss Payment Standards (iso-payments.ch) und gilt bei PostFinance gleichermassen. Abweichend sind nur die EBICS-Auftragsarten, siehe «SGKB gegen PostFinance aus Entwicklersicht». Für PostFinance liegt zusätzlich eine Musterdatei als XML bereit, die sich direkt als Test-Fixture verwenden lässt.

**Kanäle:** camt.052 (Intraday), camt.053 (Tagesauszug) und camt.054 (Sammelauflösung, Gutschrifts- und Belastungsanzeige) kommen über EBICS **und** über das E-Banking. Gleiche Datei, gleicher Parser. Start mit manuellem Download im E-Banking, EBICS später ohne Codeänderung.

**Felder in camt.054 pro Gutschrift** (`Ntry/NtryDtls/TxDtls`), die `markInvoicePaid` in ai-proxy `src/invoice-subscription.ts` braucht:

| Feld | Inhalt laut SGKB | Verwendung |
|---|---|---|
| `CdtDbtInd` | `CRDT` | nur Gutschriften verarbeiten |
| `RmtInf/Strd/CdtrRefInf/Tp/CdOrPrtry/Prtry` | `QRR` bei QR-IBAN mit QR-Referenz, `ESR` bei LSV. SCOR steht als `Cd` | Parser liest `Cd` und `Prtry` |
| `RmtInf/Strd/CdtrRefInf/Ref` | QR-Referenz (27 Ziffern) oder SCOR-Referenz | Schlüssel für `markInvoicePaid`, identisch mit `invoiceReference` in `src/invoice.ts` |
| `Amt` | Betrag, Währung als Attribut | gegen `invoice.amount` prüfen |
| `Chrgs/TtlChrgsAndTaxAmt` | bei QR «Total Gebühren» | Abzug kennen, falls Betrag abweicht |
| `RltdPties/Dbtr/Nm`, `UltmtDbtr/Nm` | Zahler, ursprünglicher Zahler | Anzeige im Report |
| `RmtInf/Strd/AddtlRmtInf` | Mitteilung aus dem QR-Code (bei QRR und SCOR) | Anzeige im Report |
| `Refs/AcctSvcrRef` | `O/Order-Nr`, eindeutig, gleich in camt.053 und camt.054 | Doppelverarbeitung verhindern |
| `Ntry/BookgDt/Dt` | Buchungsdatum, steht am Eintrag und nicht an der Zahlung | `paidAt` |
| `Ntry/NtryRef` | bei QRR-Gutschrift die QR-IBAN | nicht mit `Stmt/Acct/Id/IBAN` (normale IBAN) verwechseln |

**Sammelbuchungen:** Mehrere QR-Eingänge am selben Tag kommen als eine Buchung mit `NtryDtls/Btch/NbOfTxs` und je einem `TxDtls` pro Zahlung. Der Parser iteriert über alle `TxDtls`, nicht über `Ntry`. camt.052 liefert nur Buchungen mit Status `BOOK`.

**Pipeline (gebaut):** camt.054 holen (E-Banking oder EBICS BTD), `billing.mjs camt <datei.xml>` (wartungsheft `scripts/billing.ts`). Der Parser liegt im AI-Proxy (`src/camt.ts`), die Zuordnung in `src/services/billing-job.ts`. Gebucht wird nur eine Gutschrift mit bekannter Referenz, passendem Betrag und noch nicht verbuchter `AcctSvcrRef`; alles andere erscheint als `PRÜFEN`.

**EBICS-Verbindungsparameter** (SGKB-PDF «EBICS Verbindungsparameter», Stand Juni 2026):

| Parameter | Wert |
|---|---|
| URL | `https://ebics.sgkb.ch/`, Port 443 |
| Hostname | `SGKB` |
| EBICS-Version | **3.0 (H005), ausschliesslich** |
| Schlüssel | Authentifizierung X002, Verschlüsselung E002, Signatur A006 |
| camt.054 «Gutschriften (QRR / SCOR)» | `BTD` / Service `REP` / Scope `CH` / Container `ZIP` / MsgName `camt.054` / Version `08` |
| camt.053 Kontoauszug | `BTD` / `EOP` / `CH` / `ZIP` / `camt.053` / `08` |
| camt.052 Intraday | `BTD` / `STM` / `CH` / `ZIP` / `camt.052` / `08` |
| Zahlungseinlieferung | `BTU` / `MCT` / `CH` / `pain.001` / `09` |

Teilnehmer-ID und Kunden-ID kommen per Brief. Die Hashwerte der Bankschlüssel stehen im PDF und werden nach dem `HPB`-Abruf verglichen.

**Nicht im Handbuch, bei SGKB klären:**

- Muss camt.054 pro Konto aktiviert werden oder kommt es automatisch mit der QR-IBAN?
- Zeitpunkt der Auslieferung (nachts, Intraday)

**Fazit:** Konto plus Parser ersetzt AbaNinja Basic (CHF 21/Mt.) für den Zahlungsabgleich vollständig. AbaNinja bliebe nur für die Buchhaltung relevant.

## SGKB gegen PostFinance aus Entwicklersicht

Beide publizieren vollständige EBICS-Verbindungsparameter samt Auftragsarten, Schlüsselverfahren und Hashwerten. Beide liefern camt.054 in der Version 08 über `BTD`. Der Unterschied liegt nicht in der Schnittstelle, sondern darin, was sich vor und ohne Kontoeröffnung entwickeln lässt.

| Punkt | SGKB | PostFinance |
|---|---|---|
| EBICS-Version | 3.0 (H005), ausschliesslich | 3.0 **und** 2.5 |
| Signaturverfahren | A006 | A005 und A006 |
| EBICS-Host | `https://ebics.sgkb.ch/`, Hostname `SGKB` | `https://ebics.postfinance.ch/ebics/ebics.aspx`, Hostname `PFEBICS` |
| camt.054 | `BTD` / `REP` / `CH` / `ZIP` / `camt.054` / `08` | Auftragsart `Z54` (Detailavis) und `ZS2` (Service-Option `XDCI`), je `BTD` / `REP` / `CH` / `ZIP` / `camt.054` / `08` |
| Testumgebung | **keine.** Tests laufen über iso20022@sgkb.ch | **öffentliche Testplattform** isotest.postfinance.ch, 7/24, Registrierung ohne Kundenbeziehung |
| EBICS im Test | erst nach Vertrag und INI-Brief | EBICS-Zugang auf der Testplattform selbst anlegen und freischalten, ohne Brief |
| Musterdateien | keine publiziert | camt.054 als XML zum Download (`camt.054.001.08`, ISO-Version 2019) |
| Weitere Kanäle | EBICS, E-Banking | EBICS, E-Banking, SFTP (MFTPF), SWIFT |
| Änderungskommunikation | Handbuch mit Änderungsnachweis | halbjährlicher Newsletter für Softwarehersteller |

**Die Testplattform ist der entscheidende Punkt.** Sie bildet genau die Pipeline von wartungsheft ab: virtuelle Konten für QR-Rechnungen anlegen, QR-Rechnung generieren, ein PDF oder PNG validieren und verarbeiten lassen, Tagesendverarbeitung simulieren, camt.054 herunterladen. Damit lässt sich der Parser nach TDD gegen echte Bankdateien entwickeln, bevor ein Konto existiert. Bei der SGKB beginnt die Entwicklung frühestens nach Kontoeröffnung und EBICS-Vertrag.

**EBICS 2.5 entscheidet über den Client.** Die SGKB spricht nur H005. Damit fällt `node-ebics/node-ebics-client` aus, der einzige reife Node-Client (85 Sterne, MIT, nur H004). Übrig bleiben `ebics-api/ebics-client-php` (PHP, ausgereift) oder der Fork `sequel-de/ebics-client` (H005, aber im September 2026 erstellt, 0 Sterne, ohne Zahlungs-Upload). PostFinance spricht beide Versionen, dort funktioniert der reife Node-Client. Bei einem TypeScript- und Node-Projekt spart das entweder eine zweite Sprache im Betrieb oder die Abhängigkeit von einem sehr jungen Fork.

**Was für die SGKB spricht:** CHF 5/Mt. ohne Kontingent gegenüber PostFinance mit 60'000 Transaktionen pro Jahr gratis, danach CHF 0.12. Das Handbuch ist aktueller und auf die Schweizer Fälle zugeschnitten. Die Bank sitzt im eigenen Marktgebiet, Ansprechpartner sind erreichbar. Technisch ist das kein Vorteil, sondern eine Frage der Geschäftsbeziehung.

**Entschieden:** PostFinance. Die Testplattform erlaubt es, den camt.054-Parser und den Abgleich in `markInvoicePaid` fertig zu bauen und zu testen, bevor die erste Rechnung rausgeht. Das Startangebot deckt zwei Jahre Grundgebühr. Die SGKB bleibt die Alternative, falls ein Konto ohne HR-Eintrag bei PostFinance doch scheitert oder eine Bank vor Ort gewünscht ist.

## Offene Fragen an die Banken

Keine Kandidatin ausser PostFinance äussert sich öffentlich zum Konto ohne HR-Eintrag. Ebenso offen ist, ob die Bank EBICS für eine kleine Einzelfirma freischaltet (keine publiziert eine Mindestgrösse) und ob die EBICS-Einrichtung gratis ist (keine Gebühr publiziert, aber auch nicht ausdrücklich ausgeschlossen). Das klärt nur eine Anfrage, z. B. im Feld «Bemerkungen» des Antragsformulars oder telefonisch:

- SGKB: Online-Eröffnung, Frage im Eröffnungsprozess oder per Kontaktformular, technische Fragen an iso20022@sgkb.ch
- PostFinance: geklärt, siehe «QR-IBAN und camt.054 bei PostFinance»

## QR-IBAN und camt.054 bei PostFinance

Geprüft an der Preisliste Geschäftskunden (475_16_de.pdf, gültig ab 01.07.2026) und den Angaben von
Software-Anbietern, die den Antrag begleiten:

| Punkt | Stand |
|---|---|
| QR-IBAN («virtuelles Konto QR-Rechnung») | Nur mit Geschäftskonto; per Formular «Anmeldung/Mutation virtuelles Konto QR-Rechnung» bestellt, mehrere pro Konto möglich. Keine Gebühr in der Preisliste |
| camt.054 (Gut-/Lastschrift) | «ISO 20022 Elektronische Konto Avisierung»: **kostenlos**. Bestellt mit dem Formular «Anmeldung/Mutation elektronische Kontodokumente» |
| camt.054 Detailavisierung fürs virtuelle Konto | halbtäglich bis monatlich **kostenlos**; stündlich oder drei feste Zeitpunkte am Tag CHF 0.08 pro Zahlung |
| camt.053, MT940, PDF-Auszüge | kostenlos |
| EBICS (inkl. App) und MFTPF | kostenlos |
| Zahlungseingänge im E-Banking | im Transaktionskontingent kostenlos, danach CHF 0.12 bzw. 0.08 pro Transaktion |

Zwei Kosten betreffen nur Bargeld am Postschalter: Einzahlungen belasten den **Empfänger** mit CHF 1.20 bis 3.95
je nach Betrag, und fehlende oder falsch platzierte Angaben zum Zahlungspflichtigen kosten **CHF 0.80 pro Beleg**
Nacherfassung. Genau davor warnt der QR-Validator, wenn Strasse und Hausnummer nicht getrennt im Zahlteil stehen
(in `invoice-pdf.ts` erledigt).

### Schaltergebühren vermeiden

Sperren lässt sich das nicht: Jede QR-Rechnung ist am Schalter einzahlbar, und die Preisliste kennt keine Option
«keine Bareinzahlungen». Was bleibt, ist Lenkung und Gelassenheit:

- **Rechnung und Mail bitten um E-Banking** («am einfachsten im E-Banking oder mit der Banking-App»,
  `invoice-pdf.ts` und `invoice-mail.ts`). Wer die Rechnung ohnehin digital bekommt, zahlt selten bar.
- **Adresse vollständig im Zahlteil**, sonst kommen zur Schaltergebühr noch CHF 0.80 Nacherfassung.
- **Grössenordnung**: Bei einer Jahresrechnung über CHF 108 wären es CHF 2.35, also gut zwei Prozent — und nur,
  wenn jemand tatsächlich bar einzahlt. Betriebe zahlen per E-Banking, Privatkunden fast immer auch.
- **Kartenzahlung ist teurer, nicht billiger**: Stripe oder Payrexx kosten rund 2.9 Prozent plus 30 Rappen, bei
  CHF 108 also etwa CHF 3.45. Ein Kartenweg lohnt sich wegen Bequemlichkeit, nicht wegen der Gebühr.
- **Weiterverrechnen** wäre möglich, lohnt sich aber nicht: Eine «Schaltergebühr» in den AGB kostet mehr
  Erklärung, als sie einbringt, und trifft ausgerechnet die Kunden ohne E-Banking.

**Damit ist die Kette bezahlbar:** QR-IBAN gratis, camt.054 gratis, Abholung gratis. Beide Formulare gehören in
den Eröffnungsantrag, sonst fehlt nachher die QR-IBAN.

## Eigene Software für QR-Zahlungseingänge

Ziel: QR-Zahlungseingänge (camt.054 mit QR-Referenz) automatisch abholen und Rechnungen zuordnen, ohne AbaNinja Basic (CHF 21/Mt., nötig für die dauerhafte Bankanbindung; Starter ist gratis, aber nur mit manuellem camt-Import).

### EBICS

EBICS verbindet den Kontoinhaber direkt mit der Bank. Die Software holt mit dem Auftrag BTD (Download) camt.053/054 ab und kann mit BTU Zahlungen hochladen. Bei beiden Kandidaten ist EBICS gratis.

Die Versionsfrage ist geklärt: SGKB nur 3.0 (H005), PostFinance 3.0 und 2.5. Davon hängt die Wahl des Clients ab, siehe «SGKB gegen PostFinance aus Entwicklersicht».

Vor der Kontoeröffnung bleibt zu klären, ob die Bank einen EBICS-Vertrag mit einer kleinen Einzelfirma abschliesst. Keine der beiden publiziert eine Mindestgrösse.

### Open-Source-Clients (Stand 19.09.2026, GitHub)

| Client | Sprache | Letzter Push | EBICS 3.0 (H005) | Lizenz | Einschätzung |
|---|---|---|---|---|---|
| **ebics-api/ebics-client-php** | PHP | 29.08.2026 | ja (2.4, 2.5, 3.0) | MIT | Am aktivsten, 72 Sterne, BTD vorhanden. Die Firma dahinter verkauft zusätzlich einen kostenpflichtigen Microservice, die Bibliothek bleibt MIT |
| **node-ebics/node-ebics-client** | Node.js | 02.04.2025 | nein, nur 2.5 (H004) | MIT | 85 Sterne, letzte Version v4.1.0 vom April 2024, wenig Aktivität. Mit PostFinance nutzbar (2.5), mit der SGKB nicht |
| **sequel-de/ebics-client** | Node.js | 16.09.2026 | ja | MIT | Fork des Node-Clients mit H005 und Schweizer BTD-Vorgaben, gegen die Testumgebung von PostFinance geprüft. Aber: erstellt am 14.09.2026, 0 Sterne, nur über GitHub Packages (Token nötig), Zahlungs-Upload (BTU) fehlt |
| **libfintx/libfintx** | .NET | 31.07.2026 | ja | LGPL-3.0 | Aktiv, kann auch FinTS/HBCI |
| spaced/ebics-web-client | Java | 08.07.2025 | unklar | LGPL-2.1 | Mässig aktiv |
| element36-io/ebics-java-client, QJonny/ebics-java-library, openyard/ebics, FinanceKey/EBICS | Java, Go, C# | 2017–2023 | – | – | Nicht mehr gepflegt |

### Selbst programmieren?

Möglich, aber nicht sinnvoll. EBICS verlangt XML-Signaturen mit Kanonisierung (A006, X002), hybride Verschlüsselung aus AES und RSA (E002), Segmentierung und Kompression sowie die Einrichtung mit Schlüsselerzeugung und unterschriebenem INI/HIA-Brief an die Bank. Das sind eher Wochen als Tage, und Fehler bei den Schlüsseln sind ein Sicherheitsrisiko. Mit einer Bibliothek bleibt wenig eigener Code: camt.054 per BTD abholen, XML auswerten, QR-Referenzen den Rechnungen zuordnen.

### Vorgehen

1. Erledigt: Der Parser (`ai-proxy/src/camt.ts`, `matchCredits`, Betragsprüfung in `markInvoicePaid`) ist auf der Testplattform gegen eine echte Bankdatei geprüft. Eine Jahresrechnung aus `invoice-pdf.ts` auf das virtuelle Konto QRR ging durch Validierung (0 Fehler) und Kreditorverarbeitung, das camt.054 liegt als Fixture im Repo und bucht die Rechnung bezahlt. Der Ablauf steht in `AGENTS.md`.
2. Nach der Kontoeröffnung: camt.054 einmal pro Woche von Hand im E-Banking herunterladen und mit dem fertigen Skript auswerten. Braucht keinen EBICS-Vertrag.
3. Wenn die Menge wächst: EBICS-Vertrag abschliessen. Bei PostFinance zusätzlich den Node-Client in Version 2.5, sonst den PHP-Client als kleinen Dienst oder den sequel-de-Fork, sobald er ausgereift ist.

## Quellen (Auswahl)

- moneyland Firmenkonto-Vergleich: https://www.moneyland.ch/de/firmenkonto-vergleich
- bexio Bankanbindungen: https://www.bexio.com/de-CH/alle-banken
- AbaNinja/Swiss21 Bankanbindungen: https://swiss21.org/verfuegbare-bankanbindungen/
- Swiss21 Preise: https://swiss21.org/preise/
- SGKB Preisliste 07/2026: https://www.sgkb.ch/.dam/4c4dedd0-3ce2-420b-bb95-700e1257b7b7/preise-sgkb-konten-karten-geldverkehr-finanzieren.pdf
- SGKB Geschäftskonto eröffnen (Marktgebiet SG und AR): https://www.sgkb.ch/de/geschaeftskunden/konten-karten-zahlen/geschaeftskonto-eroeffnen
- SGKB Online-Eröffnung: https://eroeffnung.sgkb.ch/geschaeftskunde
- SGKB EBICS: https://www.sgkb.ch/de/geschaeftskunden/konten-karten-zahlen/zahlungsverkehr/e-banking/ebics
- SGKB QR-Rechnung mit Referenz: https://www.sgkb.ch/de/geschaeftskunden/konten-karten-zahlen/zahlungsverkehr/zahlungseingaenge/qr-rechnung-mit-referenz
- SGKB Cash-Management-Handbuch (camt.052/053/054): https://www.sgkb.ch/.dam/e4f7e04a-0c64-442e-a990-e4c1fef1ef30/sgkb-cash-management-handbuch.pdf
- SGKB Cash Management: https://www.sgkb.ch/de/geschaeftskunden/konten-karten-zahlen/zahlungsverkehr/cash-management
- SGKB EBICS Verbindungsparameter (Juni 2026): https://www.sgkb.ch/.dam/27480b66-754f-4902-b4d3-2630c26d9bd4/EBICS-verbindungsparameter.pdf
- SGKB ISO-Readiness (Softwarepartner, Tests über iso20022@sgkb.ch): https://www.sgkb.ch/de/geschaeftskunden/iso-readiness
- PostFinance EBICS-Parameterblatt: https://www.postfinance.ch/content/dam/pfch/doc/0_399/01765_en.pdf
- PostFinance Testplattform (Registrierung ohne Kundenbeziehung): https://isotest.postfinance.ch/
- PostFinance Testplattform Benutzerhandbuch: https://isotest.postfinance.ch/corporates/help/PostFinance_Testplattform_BenHB.pdf
- PostFinance Testplattform Quickstart: https://isotest.postfinance.ch/corporates/help/PostFinance_Testplattform_Quickstart.pdf
- PostFinance Musterdatei camt.054.001.08: https://www.postfinance.ch/content/dam/pfch/doc/musterfile/camt054_P_CH2909000000250094239_1111111112_0_2022031011011199_v2019.xml
- PostFinance Informationen für Softwarehersteller: https://www.postfinance.ch/de/support/partner/hersteller-haendler.html
- Zuger KB EBICS Verbindungsparameter: https://www.zugerkb.ch/docs/default-source/firmen/ebics-verbindungsparameter.pdf
- TKB Einzelpreisliste 01/2026: https://www.tkb.ch/.dam/39ccebd9-6406-45ce-8c39-d794f5a4d9d9/20170117_KOND0011_Einzelpreisliste_Basisdienstleitungen_Unternehmen_2.pdf
- TKB Business Classic: https://www.tkb.ch/firmen/produkte/konten-servicepakete/servicepaket-business-classic
- TKB Gründungsservice: https://www.tkb.ch/firmen/beratung-service/gruendungsservice
- TKB EBICS: https://www.tkb.ch/firmen/produkte/zahlungsverkehr/ebics
- TKB-Gesetz: https://www.rechtsbuch.tg.ch/app/de/texts_of_law/951.1
- acrevis Preise 07/2026: https://www.acrevis.ch/document/uebersicht-dienstleistungspreise
- acrevis EBICS: https://www.acrevis.ch/geschaeftlich/konto-und-karte/ebics
- Appenzeller KB Kontoführung: https://www.appkb.ch/firmen/firmen-zahlen/firmen-zahlen-konditionen-kontofuehrung
- Appenzeller KB EBICS: https://www.appkb.ch/firmen/firmen-zahlen/ebics
- Raiffeisenbank Regio Arbon Preise 07/2026: https://www.raiffeisen.ch/content/dam/www/regio-arbon/pdf/dienstleistungspreise/dl-preise-2026/Dienstleistungspreise-Firmenkunden-Regio-Arbon-ab-07-2026.pdf
- Raiffeisenbank Regio Arbon Standorte: https://www.raiffeisen.ch/regio-arbon/de/ueber-uns/standorte-bancomaten.html
- Valiant Porträt (15 Kantone): https://www.valiant.ch/en/ueber-valiant/ihre-valiant-portrait
- ZKB-Gesetz (Geschäftsbereich): https://www.notes.zh.ch/appl/zhlex_r.nsf/OpenAttachment?Open&docid=FFD94D8863194C39C1258BF9002392CE&file=951.1_28.9.97_127.pdf
- BEKB Organisations- und Geschäftsreglement: https://www.bekb.ch/-/media/bekb/portal/documents/ueber-bekb/aktionaere/corporate-governance/ogr-bekb.pdf
- FKB-Gesetz: https://bdlf.fr.ch/app/de/texts_of_law/961.1
- PostFinance Preise Geschäftskunden (ab 1.7.2026): https://www.postfinance.ch/content/dam/pfch/doc/460_479/475_16_de.pdf
- Zuger KB Konditionen Firmenkunden: https://www.zugerkb.ch/docs/default-source/broschueren/konditionen-im-basisgeschaeft-firmenkunden.pdf
- FKB Selbständigen-Paket: https://www.bcf.ch/de/firmenkunden/konti-und-karten/pakete/selbststaendige-paket
- Valiant Preise und Dienstleistungen: https://www.valiant.ch/documents/35003/44310/Preise+und+Dienstleistungen.pdf
- Hypothekarbank Lenzburg Preise (ab 1.4.2026): https://www.hbl.ch/media/meoakt2o/ab-20260401_dienstleistungspreise-kontofuehrung_zahlungsverkehr.pdf
- ZKB Preise Firmenkunden: https://zkb.ch/media/dokumente/legal/firmenkunden_preise_konditionen.pdf
- ZKB EBICS: https://www.zkb.ch/de/unternehmen/digitales-banking/software-anbindungen/anbindung-via-datalink-ebics.html
- Raiffeisen QR-Rechnung: https://www.raiffeisen.ch/rch/de/unternehmen/zahlungsverkehr/zahlungen-erhalten/qr-rechnung.html
- Raiffeisen EBICS: https://www.raiffeisen.ch/rch/de/unternehmen/zahlungsverkehr/standards-und-schnittstellen/ebics.html
- Bank Cler Kontokorrent: https://www.cler.ch/de/zahlen-und-sparen/immobilienkunden/kontokorrentkonto
- Bank Cler EBICS: https://www.cler.ch/de/info/datenaustausch-schnittstellen/ebics
- BEKB Preisübersicht: https://www.bekb.ch/-/media/bekb/portal/documents/preisuebersicht-chf-bekb.pdf
- BEKB EBICS: https://www.bekb.ch/de/firmenkunden/zahlen/zahlungsverkehr/ebics
- Valiant Business Set Basis: https://www.valiant.ch/de/geschaeftskunden/zahlen-unsere-business-sets-business-set-basis
- Valiant EBICS: https://www.valiant.ch/de/geschaeftskunden/services-ebics
- Zuger KB Kontokorrent: https://www.zugerkb.ch/firmen/konten-und-karten/konten/kontokorrent
- Zuger KB EBICS: https://www.zugerkb.ch/firmen/konten-und-karten/zahlungen-und-rechnungen/ebics
- FKB Kontokorrent: https://www.bcf.ch/de/firmenkunden/konti-und-karten/konti/kontokorrent
- FKB EBICS: https://www.bcf.ch/de/firmenkunden/digital-banking/bankdienstleistungen/ebics
- AKB Firmenkonto: https://www.akb.ch/firmen/konten/firmenkonten/chf
- AKB EBICS: https://www.akb.ch/firmen/bezahlen/software-anbindungen/ebics
- Hypothekarbank Lenzburg Kontokorrent: https://www.hbl.ch/de/firmen/zahlen/geschaeftskonten/kontokorrent/
- Hypothekarbank Lenzburg E-Banking/EBICS: https://www.hbl.ch/de/e-banking/informationen-zum-e-banking/e-banking-fuer-firmen-und-vereine/
- PostFinance Geschäftskonto: https://www.postfinance.ch/en/business/products/payment-transactions/accounts/business-account-chf.html
- PostFinance Startangebot: https://www.postfinance.ch/en/business/company-type/founders-start-ups/start-up-package.html
- PostFinance QR-Rechnung: https://www.postfinance.ch/en/business/products/invoices/qr-bill.html
- PostFinance EBICS: https://www.postfinance.ch/en/business/products/payment-transactions/e-banking-apps-channels/technical-business-channels.html
- UBS Geschäftskonto: https://www.ubs.com/ch/de/services/accounts-and-cards/corporate-accounts/business-account.html
- UBS KeyPort (EBICS): https://www.ubs.com/ch/de/services/payments/connection-ubs/keyport.html
- Migros Bank Checkliste Einzelunternehmen: https://www.migrosbank.ch/de/dam/jcr:1d494452-53e5-4091-87e9-fdb207684da5/Checkliste_Einzelunternehmen.pdf
- Migros Bank Preise: https://www.migrosbank.ch/dam/jcr:f49f70eb-c052-49ff-92fc-a06630032018/preise_fuer_dienstleistungen_de.2026-06-01-13-26-09.pdf
- ABS Konto für Einzelunternehmen: https://www.abs.ch/de/konto-fuer-einzelunternehmen
- Bank WIR Business pro: https://www.wir.ch/de/firmenkunden/konto/paket-business-pro/
- Bank WIR Online-Kontoeröffnung (Kriterien): https://sob.wir.ch/sites/onboarding/account-type-selection?language=de
- Bank WIR QR-Rechnung: https://www.wir.ch/de/firmenkunden/zahlungsverkehr/qr-rechnung/
- Yapeal Geschäftskonten: https://yapeal.ch/de/loesungen/effizienz-loesungen/schweizer-geschaeftskonten/
- Yapeal Support (HR-Pflicht, camt.053): https://yapeal.ch/de/support/
- Revolut Business Tarife: https://www.revolut.com/de-CH/business/business-account-plans/
- Revolut QR-Code-Zahlungen: https://help.revolut.com/en-CH/business/help/receiving-payments/sending-money-to-an-external-bank-account/sending-qr-code-payments/
- Revolut Freiberufler-Abos (Business vs. Pro): https://help.revolut.com/de-CH/help/account-management-plans-and-billings/billings-and-allowances/changes-to-our-freelancer-plans/business/
- Wise Business Preise: https://wise.com/ch/pricing/business/
- Wise CHF-Überweisungen: https://wise.com/help/articles/2932338/guide-to-chf-transfers
- Yuh FAQ: https://www.yuh.com/de/help/faq/
- neon FAQ: https://www.neon-free.ch/en/faq/can-i-open-a-business-account-with-neon
- radicant Einstellung: https://www.radicant.com/en/press/radicant-gibt-die-geschaftstatigkeit-auf-und-sucht-anschlusslosungen-fur-kundinnen-und-kunden/
- EBICS-Client PHP: https://github.com/ebics-api/ebics-client-php
- EBICS-Client Node.js: https://github.com/node-ebics/node-ebics-client
- EBICS-Client Node.js mit H005 (Fork): https://github.com/sequel-de/ebics-client
- libfintx (.NET): https://github.com/libfintx/libfintx
- ebics-web-client (Java): https://github.com/spaced/ebics-web-client
