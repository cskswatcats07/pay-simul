/**
 * Country-specific payment methods.
 * Each country code maps to payment method values available in that country.
 */

import type { PaymentMethodValue } from './rails'

export const COUNTRY_PAYMENT_METHODS: Record<string, PaymentMethodValue[]> = {
  US: ['card', 'ach', 'wire', 'rtr', 'wallet'],
  CA: ['card', 'etransfer', 'wire', 'rtr', 'wallet'],
  GB: ['card', 'sepa', 'wire', 'rtr', 'wallet'],
  DE: ['card', 'sepa', 'wire', 'rtr', 'wallet'],
  FR: ['card', 'sepa', 'wire', 'rtr', 'wallet'],
  SG: ['card', 'wire', 'rtr', 'wallet'],
  JP: ['card', 'wire', 'rtr', 'wallet'],
  AU: ['card', 'wire', 'rtr', 'wallet'],
  IN: ['card', 'upi', 'wire', 'rtr', 'wallet'],
}

export function getPaymentMethodsForCountry(countryCode: string): PaymentMethodValue[] {
  return COUNTRY_PAYMENT_METHODS[countryCode] ?? ['card', 'wire', 'rtr', 'wallet']
}
