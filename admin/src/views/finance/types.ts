/** Row types for the finance screens. Amounts are decimal strings on the wire. */

export type FiatDepositRow = {
  depositId: number
  userId: number | string
  amount: string
  currency: string
  transactionId: string
  bankName?: string | null
  accountHolderName?: string | null
  upiId?: string | null
  status: 'pending' | 'approved' | 'rejected' | string
  hasScreenshot: boolean
  adminComment?: string | null
  createdAt: string
  accountNumber?: string | null
  ifscCode?: string | null
  handledBy?: number | string | null
  handledAt?: string | null
}

export type DepositStats = {
  totalTransactions: number
  totalAmount: string
  successfulAmount: string
  processingAmount: string
  successfulTransactions: number
  processingTransactions: number
  failedTransactions: number
  currency: string
  byProvider?: Record<string, unknown>
}

export type CryptoDepositRow = {
  id: number | string
  userId: number | string
  chain?: string | null
  orderId?: string | null
  address?: string | null
  status: string
  amountUsd: string
  amountInr: string
  createdAt: string
}

/** `admin/user/history/deposits` and `/withdrawals` — every rail merged. */
export type RailTransactionRow = {
  provider: string
  id: number | string
  userId: number | string
  reference?: string | null
  amount: string
  currency: string
  status: string
  rawStatus?: string | null
  createdAt: string
}

/** `admin/user/payments/users/:userId/orders` */
export type PaymentOrderRow = {
  provider: string
  flow: 'payin' | 'payout' | string
  reference: string
  amount: string
  currency: string
  status: string
  rawStatus?: string | null
  providerReference?: string | null
  userId?: number | string
  createdAt?: string | null
}

export type FiatWithdrawalRow = {
  withdrawalId: number
  userId: number | string
  amount: string
  currency: string
  accountHolderName?: string | null
  bankName?: string | null
  upiId?: string | null
  status: string
  requestedAt?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
}

export const FIAT_WITHDRAW_STATUSES = ['In Queue', 'Approved', 'Rejected', 'Paid'] as const

export type CryptoWithdrawalRow = {
  id: number
  userId: number | string
  amount: string
  coin: string
  chain?: string | null
  wallet: string
  status: string
  txid?: string | null
  date?: string | null
  note?: string | null
  decidedBy?: number | string | null
  decidedAt?: string | null
}

export const CRYPTO_WITHDRAW_STATUSES = ['In Queue', 'Approved', 'Sent', 'Rejected'] as const

export type CryptoWithdrawSummary = { status: string; coin: string; count: number; total: string }

export type WalletBalanceRow = {
  uid: number | string
  name: string
  balances: Record<string, string>
}

export type StaffTransferRow = {
  id: number
  from: { type: string; id: number | string; name?: string | null }
  to: { type: string; id: number | string; name?: string | null }
  amount: string
  direction: 'deposit' | 'withdraw' | string
  transferType?: string | null
  createdAt?: string | null
}

export type TransferSummary = { direction: string; count: number; total: string }

export type ExchangeRateRow = { currency: string; usdRate: string; lastUpdated?: string | null }

export type VaultStat = { coin: string; totalUsers: number; totalBalance: string; todayInterest: string }

export type VaultLockPeriod = { value: string; label: string; days: number; rate: string }

/** Raw `vault_pro` rows — the platform returns them unshaped. */
export type VaultDepositRow = Record<string, unknown> & {
  id: number | string
  userid?: number | string
  coin?: string
  vaultBalance?: string
  lock_period?: string
  interest_rate?: string
  startTime?: string
  endTime?: string
  status?: string
  createdAt?: string
}

export type VaultInterestRow = Record<string, unknown> & {
  id: number | string
  userid?: number | string
  coin?: string
  deposit_id?: number | string
  interest?: string
  rate?: string
  createdAt?: string
}

/** P2P admin listings return raw rows (snake_case). */
export type P2pOrderRow = Record<string, unknown> & {
  id: number | string
  order_no?: string
  user_id?: string
  offer_id?: number | string
  coin?: string
  fiat?: string
  price?: string
  crypto_amount?: string
  fiat_amount?: string
  status?: string
  utr_number?: string | null
  expires_at?: string | null
  paid_at?: string | null
  created_at?: string
  payment_proof_size?: number | null
  admin_note?: string | null
  account_name?: string | null
  account_number?: string | null
  ifsc_code?: string | null
  upi_id?: string | null
  qr_image_type?: string | null
}

export type P2pDisputeRow = Record<string, unknown> & {
  id: number | string
  order_id?: number | string
  order_no?: string | null
  user_id?: string
  order_type?: 'BUY' | 'SELL' | string
  reason?: string
  message?: string | null
  status?: string
  admin_note?: string | null
  screenshot_size?: number | null
  resolved_at?: string | null
  created_at?: string
}

export type P2pOfferRow = Record<string, unknown> & {
  id: number | string
  coin?: string
  fiat?: string
  segment?: string
  price?: string
  availableAmount?: string
  minLimit?: string | null
  maxLimit?: string | null
  paymentTime?: number | null
  username?: string | null
  status?: string
  isFeatured?: boolean
  isVerified?: boolean
  isKycVerified?: boolean
  createdAt?: string
}

export type P2pPaymentType = Record<string, unknown> & { id: number | string; name?: string; code?: string; createdAt?: string; created_at?: string }

export type P2pPaymentAccount = Record<string, unknown> & {
  id: number | string
  paymentTypeId?: number | string
  accountName?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
  upiId?: string | null
  extraDetails?: string | null
}

export const P2P_COINS = ['USDT', 'INR', 'BTC', 'ETH', 'TRX'] as const
export const P2P_FIAT = ['INR', 'USD', 'PKR', 'NPR', 'BDT'] as const
export const P2P_ORDER_STATUSES = ['PENDING', 'PAID', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] as const
export const P2P_SELL_STATUSES = ['PENDING', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] as const
export const P2P_DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const
export const P2P_OFFER_STATUSES = ['ACTIVE', 'PAUSED', 'CLOSED'] as const

export type BankDetailRow = {
  id: number
  coinType: string
  bankName?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
  accountHolderName?: string | null
  upiId?: string | null
  hasQrImage: boolean
  isActive: boolean
}

/** The wallet's currency allow-list (`wallet.constants.SUPPORTED_CURRENCIES`). */
export const SUPPORTED_CURRENCIES = [
  'BTC', 'ETH', 'LTC', 'BCH', 'USDT', 'TRX', 'DOGE', 'ADA', 'XRP', 'BNB', 'USDP', 'NEXO', 'MKR', 'TUSD',
  'USDC', 'BUSD', 'NC', 'INR', 'SHIB', 'MATIC', 'SC', 'MVR', 'BJB', 'AED', 'NPR', 'PKR', 'EUR', 'BDT'
] as const

export const FIAT_CURRENCIES = ['INR', 'BDT', 'NPR', 'PKR', 'AED', 'EUR'] as const

export const PSP_PROVIDERS = ['waypay', 'apay', 'cricpay', 'upi'] as const
