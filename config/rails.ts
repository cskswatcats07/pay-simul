export const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit/Debit Card', icon: '💳' },
  { value: 'ach', label: 'ACH Transfer', icon: '🏦' },
  { value: 'wire', label: 'Wire (ISO 20022)', icon: '📤' },
  { value: 'rtr', label: 'RTR (Real-Time)', icon: '⚡' },
  { value: 'etransfer', label: 'eTransfer', icon: '📱' },
  { value: 'wallet', label: 'Digital Wallet', icon: '👛' },
  { value: 'sepa', label: 'SEPA', icon: '🇪🇺' },
  { value: 'upi', label: 'UPI', icon: '🇮🇳' },
] as const

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value']

export const WIRE_PAYMENT_TYPES = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
] as const

export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IN', label: 'India' },
  { value: 'SG', label: 'Singapore' },
  { value: 'JP', label: 'Japan' },
  { value: 'AU', label: 'Australia' },
] as const

export const CURRENCIES = [
  { value: 'USD', label: 'USD', flag: '🇺🇸' },
  { value: 'CAD', label: 'CAD', flag: '🇨🇦' },
  { value: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { value: 'GBP', label: 'GBP', flag: '🇬🇧' },
  { value: 'JPY', label: 'JPY', flag: '🇯🇵' },
  { value: 'SGD', label: 'SGD', flag: '🇸🇬' },
  { value: 'AUD', label: 'AUD', flag: '🇦🇺' },
  { value: 'INR', label: 'INR', flag: '🇮🇳' },
] as const

export const ORIGINATORS = [
  { value: 'merchant', label: 'Merchant' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'bank', label: 'Bank' },
  { value: 'payment_processor', label: 'Payment Processor' },
  { value: 'payment_aggregator', label: 'Payment Aggregator' },
] as const
