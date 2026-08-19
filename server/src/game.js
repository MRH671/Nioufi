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

// Durées des timers de tour (ms)
const T = {
  CUT: 45000,        // le coupeur choisit où couper
  BET: 45000,        // chaque tour de mise
  PRE_REVEAL: 30000, // la banque retourne
  DECIDE: 45000,     // décision après les résultats
  BETWEEN: 60000,    // relance de la manche suivante
  CEREMONY_EXTRA: 30000,
};

// ─── Room ─────────────────────────────────────────────────────────────────────
class Room {
  constructor(hostKey, hostName, hostCoins = 100, hostUserId = null) {
    this.code = randCode();
    this.hostKey = hostKey;
    this.phase = "lobby"; // lobby | ceremony | betting | pre_reveal | revealing | between_rounds
    this.players = [{ key: hostKey, name: hostName, coins: hostCoins, connected: true, userId: hostUserId }];
    this.bankIdx = null;
    this.cutterIdx = null;
    this.ceremony = null; // { steps: [{card,pIdx,asNum}], startedAt }
    this.deck = null;
    this.hands = null;     // [[card,...], ...] — JAMAIS envoyé tel quel
    this.bets = [];        // [{bettor, house, amount}]
    this.betIdx = -1;
    this.results = null;   // [{score, delta, win, role}]
    this.nineWinner = -1;
    this.bankQueue = [];   // prétendants à la banque (parieurs sur la maison à 9)
    this.nineHouse = -1;
    this.revealAt = null;
    this.feed = [];
    this.deadline = null; // timestamp limite de l'action en cours
    this.createdAt = Date.now();
  }

  n() { return this.players.length; }
  idx(key) { return this.players.findIndex((p) => p.key === key); }

  pushFeed(msg) {
    this.feed = [{ t: Date.now(), msg }, ...this.feed].slice(0, 18);
  }

  // ── Rejoindre ──
  join(key, name, coins = 100, userId = null) {
    const existing = this.idx(key);
    if (existing !== -1) { this.players[existing].connected = true; return { ok: true, rejoined: true }; }
    if (this.phase !== "lobby") return { ok: false, error: "La partie a déjà commencé." };
    if (this.n() >= 13) return { ok: false, error: "Table pleine (13 max)." };
    this.players.push({ key, name, coins, connected: true, userId });
    this.pushFeed(`👋 ${name} rejoint la table`);
    return { ok: true };
  }

  // ── Quitter la table ──
  leave(key) {
    const me = this.idx(key);
    if (me === -1) return { ok: false, error: "Pas à la table." };
    const name = this.players[me].name;
    if (this.phase === "lobby") {
      this.players.splice(me, 1);
      // L'hôte part → le suivant hérite de la couronne
      if (key === this.hostKey && this.players.length > 0) this.hostKey = this.players[0].key;
      this.pushFeed(`🚪 ${name} quitte la table`);
      return { ok: true, removed: true, empty: this.players.length === 0 };
    }
    // En partie : le siège reste (la manche continue), le joueur est marqué parti
    this.players[me].connected = false;
    this.pushFeed(`🚪 ${name} quitte la partie`);
    return { ok: true, removed: false, empty: false };
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
    this.deadline = Date.now() + steps.length * 850 + T.CEREMONY_EXTRA;
    this.pushFeed("🂡 Distribution pour désigner la banque...");
    return { ok: true };
  }

  // ── Nouvelle manche : d'abord la coupe, puis la distribution ──
  startRound(key, system = false) {
    if (!system && this.idx(key) !== this.bankIdx) return { ok: false, error: "Seule la banque distribue." };
    if (!["ceremony", "between_rounds"].includes(this.phase)) return { ok: false, error: "Pas maintenant." };

    // Joueurs fauchés = spectateurs. Il faut au moins 1 joueur solvable face à la banque.
    const solvent = this.players.filter((p, i) => i !== this.bankIdx && p.coins > 0).length;
    if (solvent === 0) return { ok: false, error: "Plus aucun joueur n'a de jetons — la banque a tout raflé ! 🏆" };

    this.deck = shuffle(buildDeck());
    this.hands = null;
    this.bets = [];
    this.betIdx = -1;
    this.results = null;
    this.nineWinner = -1;
    this.bankQueue = [];
    this.nineHouse = -1;
    this.revealAt = null;
    this.phase = "cutting";
    this.deadline = Date.now() + T.CUT;
    this.pushFeed(`✂️ ${this.players[this.cutterIdx].name} doit couper le paquet`);
    return { ok: true };
  }

  // ── Coupe du paquet par le coupeur ──
  cutDeck(key, pos, system = false) {
    if (this.phase !== "cutting") return { ok: false, error: "Pas maintenant." };
    if (!system && this.idx(key) !== this.cutterIdx) return { ok: false, error: "Ce n'est pas à toi de couper." };
    pos = Math.floor(Number(pos));
    if (!pos || pos < 5 || pos > 35) return { ok: false, error: "Coupe entre la 5e et la 35e carte." };

    // Coupe réelle : le dessous passe au-dessus
    this.deck = this.deck.slice(pos).concat(this.deck.slice(0, pos));
    this.pushFeed(`✂️ ${this.players[this.cutterIdx].name} coupe le paquet à la ${pos}e carte`);

    // Distribution : 1 carte cachée à chacun, banque en dernier
    const order = this.dealOrder();
    this.hands = Array(this.n()).fill(null).map(() => []);
    order.forEach((pIdx, step) => this.hands[pIdx].push(this.deck[step]));
    this._deckPos = this.n();
    this.betIdx = this.firstBettor();
    this.phase = "betting";
    this.deadline = Date.now() + T.BET;
    this.pushFeed(`🂠 ${this.players[this.bankIdx].name} distribue une carte à chacun`);
    return { ok: true };
  }

  /** Prochain coupeur : rotation en sautant la banque */
  advanceCutter() {
    for (let k = 1; k <= this.n(); k++) {
      const i = (this.cutterIdx + k) % this.n();
      if (i !== this.bankIdx) { this.cutterIdx = i; return; }
    }
  }

  dealOrder() {
    const order = [];
    for (let k = 1; k <= this.n(); k++) order.push((this.bankIdx + k) % this.n());
    return order; // gauche de la banque → banque en dernier
  }

  /** Premier joueur non-banque avec des jetons */
  firstBettor() {
    for (let k = 1; k < this.n(); k++) {
      const i = (this.bankIdx + k) % this.n();
      if (this.players[i].coins > 0) return i;
    }
    return -1;
  }

  /** Prochain parieur solvable après `from`, ou -1 si le tour est bouclé */
  nextBettor(from) {
    for (let k = 1; k < this.n(); k++) {
      const i = (from + k) % this.n();
      if (i === this.bankIdx) continue;
      if (this.players[i].coins <= 0) continue;
      if (i === this.firstBettor()) return -1; // on a fait le tour
      return i;
    }
    return -1;
  }

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

    // La banque doit pouvoir couvrir TOUTES les mises — jamais de solde négatif.
    const totalBets = this.bets.reduce((s, b) => s + b.amount, 0);
    const bankAvail = this.players[this.bankIdx].coins - totalBets;
    if (amount > bankAvail) {
      return { ok: false, error: bankAvail > 0 ? `La banque ne peut couvrir que ${bankAvail} jetons de plus.` : "La banque ne peut plus rien couvrir." };
    }

    this.bets.push({ bettor: me, house, amount });
    this.deadline = Date.now() + T.BET;
    this.pushFeed(`💰 ${this.players[me].name} mise ${amount} sur ${house === me ? "sa maison" : "la maison de " + this.players[house].name}`);
    return { ok: true };
  }

  endBettingTurn(key, system = false) {
    const me = system ? this.betIdx : this.idx(key);
    if (this.phase !== "betting" || me !== this.betIdx) return { ok: false, error: "Pas ton tour." };

    const next = this.nextBettor(me);

    if (next === -1) {
      // Tous ont misé → 2 cartes à chacun, banque en dernier
      const order = this.dealOrder();
      for (let c = 0; c < 2; c++)
        for (const pIdx of order)
          this.hands[pIdx].push(this.deck[this._deckPos++]);
      this.betIdx = -1;
      this.phase = "pre_reveal";
      this.deadline = Date.now() + T.PRE_REVEAL;
      const total = this.bets.reduce((s, b) => s + b.amount, 0);
      this.pushFeed(`🏦 La banque couvre ${total} jetons. 2 cartes pour tout le monde !`);
    } else {
      this.pushFeed(`✓ ${this.players[me].name} a terminé ses mises`);
      this.betIdx = next;
      this.deadline = Date.now() + T.BET;
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
  reveal(key, system = false) {
    if (!system && this.idx(key) !== this.bankIdx) return { ok: false, error: "Seule la banque retourne." };
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
    // ── Qui peut prendre la banque ? ──
    // Règle : il faut avoir MISÉ sur une maison qui fait 9 (posséder la maison ne suffit pas).
    // Si plusieurs maisons font 9 : priorité à la première dans le sens de la distribution,
    // mais si tous ses parieurs refusent, la main passe aux parieurs de la suivante.
    // Sur chaque maison : le propriétaire s'il a misé dessus, sinon le plus gros parieur, etc.
    this.bankQueue = []; // [{ p: joueur, house: maison à 9 concernée }]
    if (bs !== 9) {
      const nineHouses = this.dealOrder().filter((i) => i !== this.bankIdx && scores[i] === 9);
      for (const nineHouse of nineHouses) {
        const totals = new Map();
        this.bets.forEach((b, order) => {
          if (b.house !== nineHouse) return;
          const t = totals.get(b.bettor) || { amount: 0, order };
          t.amount += b.amount;
          totals.set(b.bettor, t);
        });
        const owner = totals.has(nineHouse) ? [nineHouse] : [];
        const others = [...totals.keys()]
          .filter((p) => p !== nineHouse)
          .sort((a, b) => {
            const ta = totals.get(a), tb = totals.get(b);
            return tb.amount - ta.amount || ta.order - tb.order;
          });
        for (const p of [...owner, ...others]) {
          // Un joueur qui a misé sur plusieurs maisons à 9 n'apparaît qu'une fois (1er refus = refus)
          if (!this.bankQueue.some((q) => q.p === p)) this.bankQueue.push({ p, house: nineHouse });
        }
        if (totals.size === 0) {
          this.pushFeed(`⭐ La maison de ${this.players[nineHouse].name} fait 9... mais personne n'avait misé dessus !`);
        }
      }
    }
    this.nineWinner = this.bankQueue.length > 0 ? this.bankQueue[0].p : -1;
    if (this.nineWinner !== -1) {
      const first = this.bankQueue[0];
      const w = this.players[first.p].name;
      const h = this.players[first.house].name;
      this.pushFeed(first.p === first.house
        ? `⭐ ${w} a misé sur sa maison qui fait 9 — il peut prendre la banque !`
        : `⭐ ${w} avait misé sur la maison de ${h} qui fait 9 — il peut prendre la banque !`);
    }
    this.revealAt = Date.now();
    this.phase = "revealing";
    this.deadline = this.revealAt + 1500 * (this.n() + 1) + T.DECIDE;
    this.pushFeed(`🔥 ${this.players[this.bankIdx].name} retourne les cartes !`);
    return { ok: true };
  }

  // ── Décision de banque après un 9 / fin de manche ──
  decideBank(key, takeIt, system = false) {
    if (this.phase !== "revealing") return { ok: false, error: "Pas maintenant." };
    const me = system ? this.nineWinner : this.idx(key);
    if (system) takeIt = false;
    // Qui a le droit de décider : le prétendant en cours, sinon la banque
    if (!system && this.nineWinner !== -1 && me !== this.nineWinner) return { ok: false, error: "Ce n'est pas à toi de décider." };
    if (!system && this.nineWinner === -1 && me !== this.bankIdx) return { ok: false, error: "Seule la banque continue." };

    // Refus → on propose au prétendant suivant de la file
    // (parieurs de la 1re maison à 9 d'abord, puis ceux de la maison suivante)
    if (!takeIt && this.nineWinner !== -1) {
      const pos = this.bankQueue.findIndex((q) => q.p === this.nineWinner);
      const cur = this.bankQueue[pos];
      const next = this.bankQueue[pos + 1];
      this.pushFeed(`🙅 ${this.players[this.nineWinner].name} laisse la banque`);
      if (next !== undefined) {
        this.nineWinner = next.p;
        this.deadline = Date.now() + T.DECIDE;
        this.pushFeed(next.house !== cur.house
          ? `⭐ La main passe à la maison de ${this.players[next.house].name} (9 aussi !) — à ${this.players[next.p].name} de décider`
          : `⭐ À ${this.players[next.p].name} de décider — il avait aussi misé sur la maison gagnante !`);
        return { ok: true };
      }
      this.nineWinner = -1; // plus personne : la banque reste
    }

    let b = this.bankIdx;
    if (takeIt && this.nineWinner === me) {
      b = me;
      this.pushFeed(`🏦 ${this.players[me].name} prend la banque !`);
    }
    if (this.players[this.bankIdx].coins <= 0 && b === this.bankIdx) {
      b = (this.bankIdx + 1) % this.n();
      this.pushFeed(`💸 La banque est ruinée ! ${this.players[b].name} reprend la banque.`);
    }

    // Qui coupe la prochaine manche ?
    if (b !== this.bankIdx) {
      // La banque change → l'ancienne banque coupe
      this.cutterIdx = this.bankIdx;
      this.pushFeed(`✂️ ${this.players[this.bankIdx].name} (ancienne banque) coupera la prochaine manche`);
    } else {
      // Rotation normale : chacun son tour, en sautant la banque
      this.advanceCutter();
    }

    this.bankIdx = b;
    // Sécurité : le coupeur ne peut pas être la nouvelle banque (hors cas cérémonie double As)
    if (this.cutterIdx === this.bankIdx) this.advanceCutter();
    this.nineWinner = -1;
    this.phase = "between_rounds";
    this.deadline = Date.now() + T.BETWEEN;
    return { ok: true };
  }

  // ── Timeout : l'action en cours est exécutée automatiquement ──
  handleTimeout() {
    const phase = this.phase;
    this.deadline = null;
    if (phase === "ceremony") {
      const r = this.startRound(null, true);
      if (r.ok) this.pushFeed("⏰ La première manche démarre !");
      return { changed: r.ok };
    }
    if (phase === "cutting") {
      const pos = 5 + Math.floor(Math.random() * 31);
      this.pushFeed(`⏰ ${this.players[this.cutterIdx].name} a tardé — coupe automatique`);
      const r = this.cutDeck(null, pos, true);
      return { changed: r.ok };
    }
    if (phase === "betting") {
      this.pushFeed(`⏰ ${this.players[this.betIdx]?.name} n'a pas misé à temps — tour passé`);
      const r = this.endBettingTurn(null, true);
      return { changed: r.ok };
    }
    if (phase === "pre_reveal") {
      this.pushFeed("⏰ Retournement automatique !");
      const r = this.reveal(null, true);
      return { changed: r.ok, revealed: r.ok };
    }
    if (phase === "revealing") {
      const r = this.decideBank(null, false, true);
      if (r.ok) this.pushFeed("⏰ Manche suivante...");
      return { changed: r.ok };
    }
    if (phase === "between_rounds") {
      const r = this.startRound(null, true);
      if (r.ok) this.pushFeed("⏰ Nouvelle manche automatique");
      return { changed: r.ok };
    }
    return { changed: false };
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
      deadline: this.deadline,
      feed: this.feed,
    };
  }
}

module.exports = { Room, score };
