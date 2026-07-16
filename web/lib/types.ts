// Types de l'état de jeu reçu du serveur (déjà filtré selon nos droits)

export type Card = { suit: string; rank: string; value: number };

export type PlayerPub = { name: string; coins: number; connected: boolean };

export type CeremonyStep = { card: Card; pIdx: number; asNum: number };

export type Bet = { bettor: number; house: number; amount: number };

export type Result = { score: number; delta: number; win: boolean; role: "bank" | "player" };

export type Phase = "lobby" | "ceremony" | "betting" | "pre_reveal" | "revealing" | "between_rounds";

export type GameState = {
  code: string;
  phase: Phase;
  isHost: boolean;
  myIdx: number;
  players: PlayerPub[];
  bankIdx: number | null;
  cutterIdx: number | null;
  ceremony: { steps: CeremonyStep[]; startedAt: number } | null;
  /** null = carte cachée pour nous ; Card = visible (phase revealing) */
  hands: (Card | null)[][] | null;
  bets: Bet[];
  betIdx: number;
  results: Result[] | null;
  nineWinner: number;
  revealAt: number | null;
  feed: { t: number; msg: string }[];
};

export type Ack = { ok: boolean; error?: string; code?: string; card?: Card; playerIdx?: number; cardIdx?: number };
