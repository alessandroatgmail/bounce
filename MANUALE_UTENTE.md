# Bounce Dance School — Manuale Utente

---

## Indice

1. [Registrazione e accesso](#1-registrazione-e-accesso)
2. [Tipi di evento](#2-tipi-di-evento)
3. [Come iscriversi a un evento](#3-come-iscriversi-a-un-evento)
4. [Tessere e quote](#4-tessere-e-quote)
5. [Lista d'attesa](#5-lista-dattesa)
6. [Pagamenti e stati della prenotazione](#6-pagamenti-e-stati-della-prenotazione)
7. [Guida per l'amministratore](#7-guida-per-lamministratore)

---

## 1. Registrazione e accesso

### Creare un account

1. Vai alla pagina **Registrazione**.
2. Inserisci nome, cognome, email e una password.
3. Riceverai una email di conferma: clicca sul link per attivare l'account.
4. Una volta attivato, accedi con email e password dalla pagina **Login**.

> L'email è l'identificativo univoco: non è possibile avere due account con la stessa email.

### Ruoli utente

| Ruolo | Cosa può fare |
|-------|--------------|
| **Studente** | Vedere gli eventi pubblicati, prenotarsi, consultare le proprie prenotazioni |
| **Insegnante** | Come studente, con accesso alle classi assegnate |
| **Admin** | Gestione completa: eventi, tessere, utenti, festival |

---

## 2. Tipi di evento

### Corso regolare (lezione settimanale)

Un corso che si ripete ogni settimana per tutta la stagione. Viene creato come evento **padre** con frequenza *settimanale*: il sistema genera automaticamente un'occorrenza figlia per ogni settimana compresa tra la data di inizio e quella di fine.

**Esempi:** Lindy Hop 1, Solo Jazz, Balboa.

- Ha un **livello** (principiante, intermedio, avanzato…)
- Può richiedere un **partner** (es. leader + follower)
- Si prenotano le singole lezioni o l'intero corso tramite una tessera

### Workshop / Evento singolo

Un evento **una tantum**: masterclass, workshop con ospiti, seminari. Non genera occorrenze ricorrenti.

**Caratteristiche:**
- Data e orario fissi
- Capacità limitata
- Spesso aperto anche a non soci (tipo accesso *libero*)

### Festival

Un evento multi-giorno con più sale e più slot orari al giorno. Può ospitare competizioni, social dance, workshop e concerti nello stesso weekend.

**Caratteristiche:**
- Strutturato in **giorni** e **sale** (ogni sala ha il proprio programma)
- La prenotazione copre l'intero festival, non i singoli slot
- Può avere tessere dedicate o essere a pagamento separato

---

## 3. Come iscriversi a un evento

### Trovare un evento

1. Vai alla sezione **Eventi** nel menu principale.
2. Usa i filtri per tipo, livello, stile o data.
3. Clicca su un evento per vedere i dettagli: descrizione, insegnanti, sala, posti disponibili.

### Prenotarsi

1. Dalla pagina dell'evento clicca **Prenota**.
2. Scegli la **tessera** con cui vuoi partecipare tra quelle disponibili.
3. Se l'evento richiede un partner, inserisci l'email del partner e seleziona il ruolo (es. Leader / Follower).
4. Conferma la prenotazione.

### Accesso libero

Alcuni eventi sono marcati come **gratuiti** (`free`): non richiedono tessera né pagamento. Basta cliccare Prenota e confermare.

### Accesso membri

Gli eventi di tipo **membri** richiedono una tessera attiva compatibile con quell'evento. Se non hai una tessera valida, la piattaforma ti avviserà.

---

## 4. Tessere e quote

Le tessere definiscono quanti eventi puoi prenotare e per quanto tempo.

| Campo | Descrizione |
|-------|-------------|
| **Quota** | Importo da versare in contanti o bonifico |
| **Durata** | Validità in mesi dalla data di attivazione |
| **Max eventi** | Numero massimo di eventi prenotabili con questa tessera |
| **Colore** | Colore identificativo per riconoscerla a colpo d'occhio |

> Una tessera può essere associata a eventi specifici: in quel caso è valida **solo** per quegli eventi.

### Regole per numero di eventi

Alcuni eventi possono avere regole aggiuntive per tessera (es. "con questa tessera puoi prenotare al massimo 2 lezioni di livello avanzato al mese"). Queste regole vengono applicate automaticamente al momento della prenotazione.

---

## 5. Lista d'attesa

Quando un evento è **al completo**, è possibile mettersi in lista d'attesa.

1. Clicca **Lista d'attesa** dalla pagina dell'evento.
2. La tua prenotazione avrà stato **In attesa**.
3. Se un posto si libera (qualcuno cancella), riceverai una notifica email e avrai **1 giorno** per confermare il pagamento.
4. Se non confermi entro il termine, il posto passa alla persona successiva in lista.

---

## 6. Pagamenti e stati della prenotazione

Ogni prenotazione (chiamata *quota* nel sistema) passa attraverso questi stati:

| Stato | Significato |
|-------|-------------|
| **Ricevuta** | La richiesta è arrivata, in attesa di verifica da parte dell'admin |
| **Accettata** | L'admin ha approvato la prenotazione; hai **7 giorni** per pagare |
| **Confermata (pagata)** | Pagamento ricevuto, sei ufficialmente iscritto |
| **In attesa** | In lista d'attesa, nessun posto disponibile al momento |
| **Cancellata** | Prenotazione annullata (da te o dall'admin) |

> Il numero di giorni per pagare può variare da evento a evento. Controllate sempre le istruzioni nella email di accettazione.

### Come avviene il pagamento

Il pagamento avviene **offline** (contanti o bonifico). Una volta verificato il versamento, l'admin aggiorna lo stato a *Confermata*. Non è previsto pagamento online diretto dalla piattaforma.

---

## 7. Guida per l'amministratore

Accedi alla dashboard admin dal menu in alto a destra dopo il login con un account di tipo **Admin**.

---

### 7.1 Creare un corso regolare

1. Vai alla scheda **Corsi regolari** nella dashboard admin.
2. Clicca **Nuovo evento**.
3. Compila i campi obbligatori:
   - **Nome** — es. "Lindy Hop 1"
   - **Tipo evento** — scegli un tipo con frequenza *settimanale*
   - **Accesso** — `members` (soci) o `free` (aperto a tutti)
   - **Data inizio / Data fine** — il sistema creerà una lezione per ogni settimana in questo intervallo
   - **Orario e durata**
   - **Sala** — la stanza dove si tiene la lezione
   - **Capienza** — numero massimo di partecipanti
4. Opzionale: aggiungi livello, insegnanti, stili musicali, tessere accettate.
5. Salva come **Bozza** per lavorarci ancora, oppure **Confermato** per generare le lezioni figlie.
6. Passa a **Pubblicato** quando vuoi che gli studenti possano prenotarsi.

> **Attenzione:** la generazione delle lezioni figlie avviene solo quando lo stato passa da *Bozza* a *Confermato*. Una volta confermato non è più possibile modificare date e frequenza senza cancellare le lezioni generate.

---

### 7.2 Creare un workshop / evento singolo

1. Vai alla scheda **Eventi** nella dashboard admin.
2. Clicca **Nuovo evento**.
3. Scegli un tipo evento con frequenza *singola*.
4. Compila data, orario, sala e capienza come sopra.
5. Pubblica quando pronto.

---

### 7.3 Creare un festival

1. Vai alla scheda **Festival** nella dashboard admin.
2. Clicca **Nuovo Festival**: si apre un wizard in due passi.

**Passo 1 — Informazioni generali:**
- Nome del festival
- Date di inizio e fine
- Sala principale, capienza, durata
- Stili, artisti, info aggiuntive

**Passo 2 — Giorni e sale:**
- Il sistema genera automaticamente un giorno per ogni data nell'intervallo.
- Per ogni giorno puoi aggiungere o rimuovere sale (es. Sala A, Sala B).
- Conferma e il festival viene creato.

Dopo la creazione, accedi al festival dalla lista per aggiungere i singoli slot/eventi all'interno di ciascuna sala e giorno tramite la griglia del festival.

---

### 7.4 Gestire le prenotazioni

Dalla scheda **Prenotazioni** puoi:

- Vedere tutte le prenotazioni per un evento
- Cambiare lo stato di una prenotazione (es. da *Accettata* a *Confermata* dopo aver ricevuto il pagamento)
- Cancellare prenotazioni
- Vedere chi è in lista d'attesa e in quale posizione

---

### 7.5 Gestire le tessere

Dalla scheda **Tessere**:

1. Clicca **Nuova tessera**.
2. Imposta nome, quota, durata e numero massimo di eventi.
3. Opzionale: associa la tessera a eventi specifici (altrimenti è valida per tutti).
4. Salva.

Le tessere vengono poi selezionate dagli studenti al momento della prenotazione.

---

### 7.6 Soglie e posti aggiuntivi

Ogni evento ha due parametri avanzati:

- **Soglia di allerta** (`warning_threshold`): quando i posti liberi scendono sotto questa soglia, l'evento viene marcato come quasi esaurito.
- **Extra** (`extras`): posti aggiuntivi riservati che non compaiono nella capienza pubblica (utili per insegnanti o ospiti).

---

*Manuale aggiornato a giugno 2026 — Bounce Dance School 2.0*
