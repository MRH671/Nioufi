// ═══════════════════════════════════════════════════════════════════════════
//  NIOUFI — Logique de jeu (côté serveur = source de vérité)
//  Aucune carte cachée n'est jamais envoyée aux clients.
// ═══════════════════════════════════════════════════════════════════════════

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "J", "Q", "K"];
const RANK_VALUES = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, J: 0, Q: 0, K: 0 };

function buildDeck() {
  const d = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ suit, rank, value: RANK_VALUES[rank] });
  return d;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const score = (cards) => cards.reduce((s, c) => s + c.value, 0) % 10;

function randCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// ─── Room ─────────────────────────────────────────────────────────────────────
class Room {
  constructor(hostKey, hostName) {
    this.code = randCode();
    this.hostKey = hostKey;
    this.phase = "lobby"; // lobby | ceremony | betting | pre_reveal | revealing | between_rounds
    this.players = [{ key: hostKey, name: hostName, coins: 100, connected: true }];
    this.bankIdx = null;
    this.cutterIdx = null;
    this.ceremony = null; // { steps: [{card,pIdx,asNum}], startedAt }
    this.deck = null;
    this.hands = null;     // [[card,...], ...] — JAMAIS envoyé tel quel
    this.bets = [];        // [{bettor, house, amount}]
    this.betIdx = -1;
    this.results = null;   // [{score, delta, win, role}]
    this.nineWinner = -1;
    this.revealAt = null;
    this.feed = [];
    this.createdAt = Date.now();
  }

  n() { return this.players.length; }
  idx(key) { return this.players.findIndex((p) => p.key === key); }

  pushFeed(msg) {
    this.feed = [{ t: Date.now(), msg }, ...this.feed].slice(0, 18);
  }

  // ── Rejoindre ──
  join(key, name) {
    const existing = this.idx(key);
    if (existing !== -1) { this.players[existing].connected = true; return { ok: true, rejoined: true }; }
    if (this.phase !== "lobby") return { ok: false, error: "La partie a déjà commencé." };
    if (this.n() >= 13) return { ok: false, error: "Table pleine (13 max)." };
    this.players.push({ key, name, coins: 100, connected: true });
    this.pushFeed(`👋 ${name} rejoint la table`);
    return { ok: true };
  }

  // ── Cérémonie des As ──
  startCeremony(key) {
    if (key !== this.hostKey) return { ok: false, error: "Seul l'hôte peut lancer." };
    if (this.phase !== "lobby") return { ok: false, error: "Déjà lancé." };
    if (this.n() < 2) return { ok: false, error: "Il faut au moins 2 joueurs." };

    const deck = shuffle(buildDeck());
    const steps = [];
    let asCount = 0, cutter = null, banker = null;
    for (let i = 0; i < deck.length; i++) {
      const card = deck[i];
      const pIdx = i % this.n();
      const isAs = card.rank === "A";
      if (isAs) asCount++;
      steps.push({ card, pIdx, asNum: isAs ? asCount : 0 });
      if (asCount === 1 && cutter === null) cutter = pIdx;
      if (asCount === 2) { banker = pIdx; break; }
    }
    this.phase = "ceremony";
    this.ceremony = { steps, startedAt: Date.now() };
    this.cutterIdx = cutter;
    this.bankIdx = banker;
    this.pushFeed("🂡 Distribution pour désigner la banque...");
    return { ok: true };
  }

  // ── Nouvelle manche : 1 carte cachée à chacun ──
  startRound(key) {
    if (this.idx(key) !== this.bankIdx) return { ok: false, error: "Seule la banque distribue." };
    if (!["ceremony", "between_rounds"].includes(this.phase)) return { ok: false, error: "Pas maintenant." };

    this.deck = shuffle(buildDeck());
    const order = this.dealOrder();
    this.hands = Array(this.n()).fill(null).map(() => []);
    order.forEach((pIdx, step) => this.hands[pIdx].push(this.deck[step]));
    this._deckPos = this.n();
    this.bets = [];
    this.betIdx = this.firstBettor();
    this.results = null;
    this.nineWinner = -1;
    this.revealAt = null;
    this.phase = "betting";
    this.pushFeed(`🂠 ${this.players[this.bankIdx].name} distribue une carte à chacun`);
    return { ok: true };
  }

  dealOrder() {
    const order = [];
    for (let k = 1; k <= this.n(); k++) order.push((this.bankIdx + k) % this.n());
    return order; // gauche de la banque → banque en dernier
  }
  firstBettor() { return (this.bankIdx + 1) % this.n(); }

  // ── Mises ──
  committed(playerIdx) {
    return this.bets.filter((b) => b.bettor === playerIdx).reduce((s, b) => s + b.amount, 0);
  }

  placeBet(key, house, amount) {
    const me = this.idx(key);
    if (this.phase !== "betting" || me !== this.betIdx) return { ok: false, error: "Pas ton tour." };
    if (house === this.bankIdx || house < 0 || house >= this.n()) return { ok: false, error: "Maison invalide." };
    amount = Math.floor(Number(amount));
    if (!amount || amount < 1) return { ok: false, error: "Mise invalide." };
    const avail = this.players[me].coins - this.committed(me);
    if (amount > avail) return { ok: false, error: `Tu n'as que ${avail} jetons dispo.` };

    this.bets.push({ bettor: me, house, amount });
    this.pushFeed(`💰 ${this.players[me].name} mise ${amount} sur ${house === me ? "sa maison" : "la maison de " + this.players[house].name}`);
    return { ok: true };
  }

  endBettingTurn(key) {
    const me = this.idx(key);
    if (this.phase !== "betting" || me !== this.betIdx) return { ok: false, error: "Pas ton tour." };

    let next = (this.betIdx + 1) % this.n();
    while (next === this.bankIdx) next = (next + 1) % this.n();

    if (next === this.firstBettor()) {
      // Tous ont misé → 2 cartes à chacun, banque en dernier
      const order = this.dealOrder();
      for (let c = 0; c < 2; c++)
        for (const pIdx of order)
          this.hands[pIdx].push(this.deck[this._deckPos++]);
      this.betIdx = -1;
      this.phase = "pre_reveal";
      const total = this.bets.reduce((s, b) => s + b.amount, 0);
      this.pushFeed(`🏦 La banque couvre ${total} jetons. 2 cartes pour tout le monde !`);
    } else {
      this.pushFeed(`✓ ${this.players[me].name} a terminé ses mises`);
      this.betIdx = next;
    }
    return { ok: true };
  }

  // ── Peek : validé côté serveur, la carte n'est envoyée qu'au demandeur ──
  peek(key, playerIdx, cardIdx) {
    const me = this.idx(key);
    if (me === -1) return { ok: false, error: "Pas à la table." };
    if (!["betting", "pre_reveal"].includes(this.phase)) return { ok: false, error: "Pas maintenant." };
    const card = this.hands?.[playerIdx]?.[cardIdx];
    if (!card) return { ok: false, error: "Carte inexistante." };

    const meIsBank = me === this.bankIdx;
    let allowed;
    if (meIsBank) allowed = playerIdx === this.bankIdx;                  // la banque : ses cartes seulement
    else if (playerIdx === this.bankIdx) allowed = false;                // jamais la banque
    else if (playerIdx === me) allowed = true;                           // toutes ses cartes
    else allowed = cardIdx === 0;                                        // 1ère carte des autres maisons
    if (!allowed) return { ok: false, error: "Tu ne peux pas voir cette carte." };

    const target = playerIdx === me ? "ses cartes" : `la carte de ${this.players[playerIdx].name}`;
    this.pushFeed(`👁 ${this.players[me].name} regarde ${target}`);
    return { ok: true, card, playerIdx, cardIdx };
  }

  // ── Retournement + résultats ──
  reveal(key) {
    if (this.idx(key) !== this.bankIdx) return { ok: false, error: "Seule la banque retourne." };
    if (this.phase !== "pre_reveal") return { ok: false, error: "Pas maintenant." };

    const scores = this.hands.map((h) => score(h));
    const bs = scores[this.bankIdx];
    const deltas = Array(this.n()).fill(0);
    for (const b of this.bets) {
      const win = bs !== 9 && scores[b.house] > bs;
      if (win) { deltas[b.bettor] += b.amount; deltas[this.bankIdx] -= b.amount; }
      else { deltas[b.bettor] -= b.amount; deltas[this.bankIdx] += b.amount; }
    }
    this.players = this.players.map((p, i) => ({ ...p, coins: p.coins + deltas[i] }));
    this.results = scores.map((s, i) => ({
      score: s, delta: deltas[i],
      win: i !== this.bankIdx && bs !== 9 && s > bs,
      role: i === this.bankIdx ? "bank" : "player",
    }));
    this.nineWinner = bs !== 9 ? scores.findIndex((s, i) => s === 9 && i !== this.bankIdx) : -1;
    this.revealAt = Date.now();
    this.phase = "revealing";
    this.pushFeed(`🔥 ${this.players[this.bankIdx].name} retourne les cartes !`);
    return { ok: true };
  }

  // ── Décision de banque après un 9 / fin de manche ──
  decideBank(key, takeIt) {
    if (this.phase !== "revealing") return { ok: false, error: "Pas maintenant." };
    const me = this.idx(key);
    // Qui a le droit de décider : le gagnant du 9, sinon la banque
    if (this.nineWinner !== -1 && me !== this.nineWinner) return { ok: false, error: "Ce n'est pas à toi de décider." };
    if (this.nineWinner === -1 && me !== this.bankIdx) return { ok: false, error: "Seule la banque continue." };

    let b = this.bankIdx;
    if (takeIt && this.nineWinner === me) {
      b = me;
      this.pushFeed(`🏦 ${this.players[me].name} prend la banque !`);
    }
    if (this.players[this.bankIdx].coins <= 0 && b === this.bankIdx) {
      b = (this.bankIdx + 1) % this.n();
      this.pushFeed(`💸 La banque est ruinée ! ${this.players[b].name} reprend la banque.`);
    }
    this.bankIdx = b;
    this.nineWinner = -1;
    this.phase = "between_rounds";
    return { ok: true };
  }

  // ── Sérialisation PAR JOUEUR : on masque tout ce qu'il n'a pas le droit de voir ──
  serializeFor(key) {
    const me = this.idx(key);
    const revealed = this.phase === "revealing";
    return {
      code: this.code,
      phase: this.phase,
      hostKey: this.hostKey === key ? key : undefined,
      isHost: this.hostKey === key,
      myIdx: me,
      players: this.players.map((p) => ({ name: p.name, coins: p.coins, connected: p.connected })),
      bankIdx: this.bankIdx,
      cutterIdx: this.cutterIdx,
      // Cérémonie : cartes publiques (face visible)
      ceremony: this.ceremony ? { steps: this.ceremony.steps, startedAt: this.ceremony.startedAt } : null,
      // Mains : seulement le NOMBRE de cartes, sauf en phase revealing où tout est public
      hands: this.hands
        ? this.hands.map((h) => (revealed ? h : h.map(() => null)))
        : null,
      bets: this.bets,
      betIdx: this.betIdx,
      results: this.results,
      nineWinner: this.nineWinner,
      revealAt: this.revealAt,
      feed: this.feed,
    };
  }
}

module.exports = { Room, score };
