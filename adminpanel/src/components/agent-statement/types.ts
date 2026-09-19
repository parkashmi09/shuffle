/* Shapes returned by GET /api/v1/admin/statements/:staffId/statement
   and             GET /api/v1/admin/statements/user/:userId/statement.

   Both endpoints return this exact shape so one screen renders either.

   ── MONEY IS A DECIMAL STRING ──────────────────────────────────────────────
   Every amount below is a string like "1234.56000000", not a number. The
   platform keeps money in exact minor units and never lets a float near a
   balance, so the wire format is the exact decimal and the screen converts at
   the point of DISPLAY.

   That matters at every call site: `a.player_pnl + b.player_pnl` on two of
   these concatenates them. Use `n()` from ./ui before doing arithmetic, and
   `money()` / `signed()` to render — both already coerce.

   ── SIGN CONVENTIONS ──────────────────────────────────────────────────────
     • ledger rows  — `amount` is signed: + into the wallet, − out of it.
     • playerPnl    — + means the players won.
     • agentPnl     — + means the agent earned (always −playerPnl).
     • headline*    — whichever of the two the subject actually keeps, so the
                      screen can say "TOTAL PROFIT"/"TOTAL LOSS" directly. */

export type SubjectType = "STAFF" | "USER";
export type Category = "all" | "money" | "sports" | "casino";

/** An exact decimal amount, as sent. Never do arithmetic on one directly. */
export type Money = string;

export type LedgerKind =
  | "DEPOSIT_UPLINE" | "WITHDRAW_UPLINE"
  | "DEPOSIT_AGENT" | "COLLECTED_AGENT"
  | "DEPOSIT_PLAYER" | "COLLECTED_PLAYER"
  | "BANK_DEPOSIT" | "GATEWAY_DEPOSIT"
  | "BANK_WITHDRAW" | "GATEWAY_WITHDRAW"
  | "SPORTS" | "CASINO";

export interface LedgerRow {
  id: string;
  ts: string;
  kind: LedgerKind;
  label: string;
  party: string;
  direction: "IN" | "OUT";
  note: string | null;
  /** Legacy transfer_type ('gt'/'casino') on pre-cash-wallet rows, else null. */
  legacy: string | null;
  amount: Money;
  balance: Money;
}

export interface StatementBalance {
  live: Money;
  /** Previous balance carried into the period. */
  opening: Money;
  closing: Money;
  movement: Money;
  depositIn: Money;
  withdrawOut: Money;
  givenDownline: Money;
  givenAgents: Money;
  givenPlayers: Money;
  collectedDownline: Money;
  collectedAgents: Money;
  collectedPlayers: Money;
  /** Bank + gateway movement. Always zero for an agent — they have neither. */
  bankIn: Money;
  bankOut: Money;
  totalIn: Money;
  totalOut: Money;
  /** Stake held in unsettled bets, out of the wallet. */
  openExposure: Money;
  /** Lifetime gap between the wallet and what the ledger explains. */
  unexplained: Money;
}

export interface Gaming {
  sports: {
    settledBets: number; placedBets: number; openBets: number;
    turnover: Money; openStake: Money;
    playerPnl: Money; agentPnl: Money;
  };
  casino: {
    txns: number; bets: number; wins: number;
    staked: Money; won: Money;
    playerPnl: Money; agentPnl: Money;
  };
  total: {
    playerPnl: Money; agentPnl: Money;
    headlinePnl: Money; headlineSports: Money; headlineCasino: Money;
    headlineFor: "AGENT" | "PLAYER";
  };
  /** The same counts as `sports`/`casino` above, as the PDF renderer reads them. */
  counts: {
    settledBets: number; placedBets: number; openBets: number;
    casinoTxns: number; casinoBets: number; casinoWins: number;
  };
}

export interface DailyRow {
  date: string; deposit: Money; withdraw: Money;
  sportsPnl: Money; casinoPnl: Money; net: Money;
}

export interface SportsDailyRow {
  date: string; bets: number; playerPnl: Money; agentPnl: Money;
}

export interface CasinoDailyRow {
  date: string; bets: number; staked: Money; won: Money;
  playerPnl: Money; agentPnl: Money;
}

export interface PlayerRow {
  id: string; name: string; staffName: string | null; wallet: Money;
  funded: Money; collected: Money;
  sportsPnl: Money; casinoPnl: Money; sportsBets: number;
  casinoBets: number; casinoStaked: Money;
  agentPnl: Money; playerPnl: Money;
}

export interface DownlineRow {
  id: string; name: string; role: string | null; depth: number;
  balance: Money; parentId: string | null; players: number;
  wallet: Money; funded: Money; collected: Money;
  /** Agent-facing on this table: what the sub-agent's players lost. */
  sportsPnl: Money; casinoPnl: Money; agentPnl: Money; playerPnl: Money;
}

export interface SportsBetRow {
  id: string; ts: string; user: string; match: string; selection: string;
  market: string; side: string; odds: string | null; stake: Money;
  status: string; result: string | null;
}

export interface CasinoTxnRow {
  id: string; ts: string; user: string; action: string;
  game: string; round: string | null; amount: Money;
}

/** The gateway's list envelope — `meta.pagination`, on every paginated route. */
export interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
  hasNext?: boolean; hasPrev?: boolean;
}

/** One page of the /bets endpoint, already unwrapped from the envelope. */
export interface BetPage<T> {
  kind: "sports" | "casino";
  rows: T[];
  pagination: Pagination;
}

export interface AgentStatement {
  subject: {
    type: SubjectType; id: string; name: string; email: string | null;
    role: string | null; level: number | null; agentCode: string | null;
    parentName: string | null;
  };
  period: { from: string | null; to: string | null };
  category: Category;
  balance: StatementBalance;
  rows: LedgerRow[];
  pagination: Pagination;
  gaming: Gaming;
  daily: DailyRow[];
  sportsDaily: SportsDailyRow[];
  casinoDaily: CasinoDailyRow[];
  players: PlayerRow[];
  downline: DownlineRow[];
}
