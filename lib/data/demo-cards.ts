/**
 * Active demo card numbers by network for testing.
 * All numbers pass Luhn validation. Use only in non-production environments.
 */

export type CardNetwork = 'Visa' | 'Mastercard' | 'AMEX' | 'Diners'

export interface DemoCard {
  id: string
  network: CardNetwork
  number: string
  last4: string
  cvv: string
  expiryMonth: string
  expiryYear: string
  description: string
}

export const DEMO_CARDS: DemoCard[] = [
  // Visa (16 digits)
  {
    id: 'visa-1',
    network: 'Visa',
    number: '4111111111111111',
    last4: '1111',
    cvv: '123',
    expiryMonth: '12',
    expiryYear: '28',
    description: 'Visa test card',
  },
  {
    id: 'visa-2',
    network: 'Visa',
    number: '4012888888881881',
    last4: '1881',
    cvv: '456',
    expiryMonth: '06',
    expiryYear: '29',
    description: 'Visa test card 2',
  },
  // Mastercard (16 digits)
  {
    id: 'mc-1',
    network: 'Mastercard',
    number: '5500000000000004',
    last4: '0004',
    cvv: '789',
    expiryMonth: '03',
    expiryYear: '27',
    description: 'Mastercard test card',
  },
  {
    id: 'mc-2',
    network: 'Mastercard',
    number: '5555555555554444',
    last4: '4444',
    cvv: '321',
    expiryMonth: '09',
    expiryYear: '28',
    description: 'Mastercard test card 2',
  },
  // AMEX (15 digits, 4-digit CVV)
  {
    id: 'amex-1',
    network: 'AMEX',
    number: '340000000000009',
    last4: '0009',
    cvv: '1234',
    expiryMonth: '12',
    expiryYear: '28',
    description: 'Amex test card',
  },
  {
    id: 'amex-2',
    network: 'AMEX',
    number: '378282246310005',
    last4: '0005',
    cvv: '5678',
    expiryMonth: '08',
    expiryYear: '29',
    description: 'Amex test card 2',
  },
  // Diners (14–19 digits, commonly 16)
  {
    id: 'diners-1',
    network: 'Diners',
    number: '3056930009020004',
    last4: '0004',
    cvv: '111',
    expiryMonth: '11',
    expiryYear: '27',
    description: 'Diners test card',
  },
  {
    id: 'diners-2',
    network: 'Diners',
    number: '36227206271667',
    last4: '1667',
    cvv: '222',
    expiryMonth: '05',
    expiryYear: '28',
    description: 'Diners test card 2',
  },
]

export function getDemoCardsByNetwork(network: CardNetwork): DemoCard[] {
  return DEMO_CARDS.filter((c) => c.network === network)
}

export function getDemoCardById(id: string): DemoCard | undefined {
  return DEMO_CARDS.find((c) => c.id === id)
}
