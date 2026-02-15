'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CardContainer, SectionTitle } from '@/components/ui'
import { PageHeader } from '@/components/layout'
import {
  PAYMENT_METHODS,
  COUNTRIES,
  CURRENCIES,
  ORIGINATORS,
  WIRE_PAYMENT_TYPES,
  type PaymentMethodValue,
} from '@/config/rails'
import { getPaymentMethodsForCountry } from '@/config/country-methods'
import { DEMO_CARDS, getDemoCardById } from '@/lib/data/demo-cards'
import {
  luhnCheck,
  normalizeCardNumber,
  maskCardNumber,
  getCardNumberMaxLength,
  getCvvLength,
  validateExpiry,
  formatCardNumberDisplay,
} from '@/lib/validation/card'
import {
  validateIndiaIfsc,
  validateIndiaAccount,
  validateUsAba,
  validateUsAccount,
  validateUkSortCode,
  validateUkAccount,
  validateCanadaInstitution,
  validateCanadaTransit,
  validateCanadaAccount,
  validateBic,
  validateGenericAccount,
} from '@/lib/validation/country-accounts'
import PaymentFlowAnimation from '@/components/PaymentFlowAnimation'
import PayloadViewer from '@/components/PayloadViewer'
import Toast from '@/components/Toast'
import { addTransaction } from '@/lib/store/transactions'
import { recordMethodUsage } from '@/lib/store/method-usage'
import { generateOrderId } from '@/lib/generators/order-id'
import { generateTransactionRef, type TransactionReference } from '@/lib/generators/transaction-ref'
import { generateUpiQrCode, validateUpiId, buildUpiUri } from '@/lib/upi/qr-generator'
import { logSimulation } from '@/lib/logging/simulation'
import type { RiskLevel } from '@/lib/types/simulation'

const MANDATORY_MARK = <span className="text-red-500">*</span>

function buildMessagePayload(
  paymentMethod: string,
  country: string,
  amount: number,
  currency: string,
  risk: RiskLevel,
  originator: string,
  orderId: string | null,
  txnRef: TransactionReference | null,
  cardNumber?: string,
  cvv?: string,
  expiryMonth?: string,
  expiryYear?: string,
  wirePaymentType?: string,
  iso20022?: {
    debtorName: string
    debtorAccount: string
    debtorBic?: string
    debtorIfsc?: string
    debtorRouting?: string
    creditorName: string
    creditorAccount: string
    creditorBic?: string
    creditorIfsc?: string
    creditorRouting?: string
    remittanceInfo?: string
  }
) {
  const id = `txn_${Date.now().toString(36)}`
  const payload: Record<string, unknown> = {
    paymentMethod,
    countryCode: country,
    amount,
    currency,
    riskProfile: risk,
    originator,
    metadata: { source: 'payflow-sim', simulation: true },
  }

  if (orderId) {
    payload.orderId = orderId
  }

  if (txnRef) {
    payload.transactionReference = {
      referenceId: txnRef.referenceId,
      type: txnRef.label,
      standard: txnRef.standard,
      ...(txnRef.additionalRefs && { additionalReferences: txnRef.additionalRefs }),
    }
  }

  if (paymentMethod === 'card' && cardNumber) {
    payload.cardNumberMasked = maskCardNumber(cardNumber)
    if (cvv) payload.cvvMasked = '***'
    if (expiryMonth && expiryYear) payload.expiry = `${expiryMonth}/${expiryYear}`
  }
  if ((paymentMethod === 'wire' || paymentMethod === 'rtr') && iso20022) {
    payload.standard = 'ISO 20022'
    payload.debtor = {
      nm: iso20022.debtorName,
      acctId: iso20022.debtorAccount,
      ...(iso20022.debtorBic && { bic: iso20022.debtorBic }),
      ...(iso20022.debtorIfsc && { ifsc: iso20022.debtorIfsc }),
      ...(iso20022.debtorRouting && { routing: iso20022.debtorRouting }),
    }
    payload.creditor = {
      nm: iso20022.creditorName,
      acctId: iso20022.creditorAccount,
      ...(iso20022.creditorBic && { bic: iso20022.creditorBic }),
      ...(iso20022.creditorIfsc && { ifsc: iso20022.creditorIfsc }),
      ...(iso20022.creditorRouting && { routing: iso20022.creditorRouting }),
    }
    if (iso20022.remittanceInfo) payload.remittanceInfo = iso20022.remittanceInfo
  }
  if (paymentMethod === 'wire' && wirePaymentType) {
    payload.paymentType = wirePaymentType
  }
  if (paymentMethod === 'rtr') {
    payload.instant = true
  }
  return {
    messageId: id,
    type: 'payment.authorization.request',
    timestamp: new Date().toISOString(),
    payload,
  }
}

function buildLedgerImpact(amount: number, currency: string, risk: RiskLevel) {
  if (risk === 'fraud' || risk === 'timeout') {
    return [
      { account: 'Pending Authorization', debit: 0, credit: 0, currency: '—', description: 'Reversed' },
      { account: 'Settlement Clearing', debit: 0, credit: 0, currency: '—', description: 'Reversed' },
    ]
  }
  return [
    { account: 'Customer Ledger', debit: amount, credit: 0, currency, description: 'Debit payer' },
    { account: 'Merchant Receivable', debit: 0, credit: amount, currency, description: 'Credit merchant' },
    { account: 'Interchange Reserve', debit: 0, credit: amount * 0.002, currency, description: 'Fee reserve' },
  ]
}

function buildFeeBreakdown(amount: number, currency: string, risk: RiskLevel) {
  if (risk === 'fraud' || risk === 'timeout') {
    return [{ name: 'No fees (transaction not completed)', amount: 0, currency, pct: 0 }]
  }
  const interchange = amount * 0.002
  const network = amount * 0.0005
  const processing = 0.25
  const total = interchange + network + processing
  return [
    { name: 'Interchange', amount: interchange, currency, pct: amount > 0 ? 0.2 : 0 },
    { name: 'Network', amount: network, currency, pct: amount > 0 ? 0.05 : 0 },
    { name: 'Processing (fixed)', amount: processing, currency, pct: 0 },
    { name: 'Total fees', amount: total, currency, pct: amount > 0 ? (total / amount) * 100 : 0, highlight: true },
  ]
}

function formatAmount(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PaymentsSimulatorDashboard() {
  const searchParams = useSearchParams()

  const [country, setCountry] = useState('US')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('card')
  const [amountRaw, setAmountRaw] = useState('100.00')
  const [currency, setCurrency] = useState('USD')
  const [risk, setRisk] = useState<RiskLevel>('normal')
  const [originator, setOriginator] = useState('merchant')
  const [wirePaymentType, setWirePaymentType] = useState('domestic')
  const [cardNumber, setCardNumber] = useState('')
  const [cvv, setCvv] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [selectedDemoCardId, setSelectedDemoCardId] = useState('')
  const [debtorName, setDebtorName] = useState('')
  const [debtorAccount, setDebtorAccount] = useState('')
  const [debtorBic, setDebtorBic] = useState('')
  const [debtorIfsc, setDebtorIfsc] = useState('')
  const [debtorRouting, setDebtorRouting] = useState('')
  const [debtorSortCode, setDebtorSortCode] = useState('')
  const [debtorInstitution, setDebtorInstitution] = useState('')
  const [debtorTransit, setDebtorTransit] = useState('')
  const [creditorName, setCreditorName] = useState('')
  const [creditorAccount, setCreditorAccount] = useState('')
  const [creditorBic, setCreditorBic] = useState('')
  const [creditorIfsc, setCreditorIfsc] = useState('')
  const [creditorRouting, setCreditorRouting] = useState('')
  const [creditorSortCode, setCreditorSortCode] = useState('')
  const [creditorInstitution, setCreditorInstitution] = useState('')
  const [creditorTransit, setCreditorTransit] = useState('')
  const [remittanceInfo, setRemittanceInfo] = useState('')

  // UPI fields
  const [upiId, setUpiId] = useState('')
  const [upiTouched, setUpiTouched] = useState(false)
  const [showUpiQr, setShowUpiQr] = useState(false)

  // eTransfer fields
  const [etransferContact, setEtransferContact] = useState('')
  const [etransferContactType, setEtransferContactType] = useState<'email' | 'mobile'>('email')
  const [etransferTouched, setEtransferTouched] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Generated IDs
  const [orderId, setOrderId] = useState<string | null>(null)
  const [txnRef, setTxnRef] = useState<TransactionReference | null>(null)

  // Real-time card validation state
  const [cardTouched, setCardTouched] = useState(false)
  const [cvvTouched, setCvvTouched] = useState(false)
  const [expiryTouched, setExpiryTouched] = useState(false)

  // Read payment method from URL query parameter (from sidebar click)
  useEffect(() => {
    const methodParam = searchParams.get('method')
    if (methodParam) {
      const valid = PAYMENT_METHODS.find((m) => m.value === methodParam)
      if (valid) {
        setPaymentMethod(methodParam as PaymentMethodValue)
        recordMethodUsage(methodParam as PaymentMethodValue)
        // Reset touched states when payment method changes via sidebar
        setCardTouched(false)
        setCvvTouched(false)
        setExpiryTouched(false)
        setUpiTouched(false)
        setShowUpiQr(false)
        setEtransferTouched(false)
      }
    }
  }, [searchParams])

  // Generate order ID when originator is merchant
  useEffect(() => {
    if (originator === 'merchant') {
      setOrderId(generateOrderId())
    } else {
      setOrderId(null)
    }
  }, [originator])

  // Generate transaction reference when payment method changes
  useEffect(() => {
    setTxnRef(generateTransactionRef(paymentMethod))
  }, [paymentMethod])

  const amount = parseFloat(amountRaw.replace(/,/g, '')) || 0
  const amountValid = amount > 0 && Number.isFinite(amount)

  // Real-time card validation
  const cardNumRaw = normalizeCardNumber(cardNumber)
  const cardNumLengthOk = cardNumRaw.length >= 13
  const cardLuhnOk = cardNumLengthOk && luhnCheck(cardNumber)
  const cardNumValid = paymentMethod !== 'card' || (cardNumLengthOk && cardLuhnOk)

  const cvvLen = getCvvLength(cardNumber)
  const cvvValid = paymentMethod !== 'card' || (cvv.length === cvvLen && /^\d+$/.test(cvv))

  const expiryValidResult = paymentMethod === 'card' ? validateExpiry(expiryMonth, expiryYear) : { valid: true as const }
  const expiryValid = paymentMethod !== 'card' || expiryValidResult.valid

  // Real-time card number error message
  const cardRealtimeError = useMemo(() => {
    if (paymentMethod !== 'card' || !cardTouched || cardNumber === '') return null
    if (cardNumRaw.length > 0 && cardNumRaw.length < 13) {
      return `Card number must be at least 13 digits (currently ${cardNumRaw.length})`
    }
    if (cardNumLengthOk && !cardLuhnOk) {
      return 'Invalid card number — Luhn check failed. Please verify the number.'
    }
    return null
  }, [paymentMethod, cardTouched, cardNumber, cardNumRaw, cardNumLengthOk, cardLuhnOk])

  // Real-time expiry error message
  const expiryRealtimeError = useMemo(() => {
    if (paymentMethod !== 'card' || !expiryTouched) return null
    if (expiryMonth === '' && expiryYear === '') return null
    if (expiryMonth.length === 2 || expiryYear.length === 2) {
      const result = validateExpiry(expiryMonth, expiryYear)
      if (!result.valid) {
        if (result.message === 'Expiry must be in the future') {
          const now = new Date()
          return `Card has expired. Expiry ${expiryMonth}/${expiryYear} is before today (${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)}).`
        }
        return result.message ?? 'Invalid expiry date'
      }
    }
    return null
  }, [paymentMethod, expiryTouched, expiryMonth, expiryYear])

  // UPI validation
  const upiValidResult = useMemo(() => {
    if (paymentMethod !== 'upi' || !upiId) return { valid: false as const, message: 'UPI ID is required' }
    return validateUpiId(upiId)
  }, [paymentMethod, upiId])
  const upiValid = paymentMethod !== 'upi' || upiValidResult.valid

  const upiRealtimeError = useMemo(() => {
    if (paymentMethod !== 'upi' || !upiTouched || upiId === '') return null
    const result = validateUpiId(upiId)
    if (!result.valid) return result.message ?? 'Invalid UPI ID'
    return null
  }, [paymentMethod, upiTouched, upiId])

  // UPI QR code generation
  const upiQrDataUri = useMemo(() => {
    if (paymentMethod !== 'upi' || !upiValidResult.valid) return null
    try {
      return generateUpiQrCode({
        vpa: upiId.trim(),
        payeeName: 'Pay Simul Test',
        amount: amount > 0 ? amount : undefined,
        currency: 'INR',
        note: 'Payment Simulation',
      })
    } catch {
      return null
    }
  }, [paymentMethod, upiValidResult.valid, upiId, amount])

  // eTransfer validation
  const etransferValidResult = useMemo(() => {
    if (paymentMethod !== 'etransfer' || !etransferContact) {
      return { valid: false, message: 'Email or mobile number is required' }
    }
    const trimmed = etransferContact.trim()
    if (etransferContactType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmed)) {
        return { valid: false, message: 'Invalid email address' }
      }
    } else {
      // Mobile: allow +, digits, spaces, hyphens, min 10 digits
      const digitsOnly = trimmed.replace(/[\s\-+()]/g, '')
      if (!/^\d{10,15}$/.test(digitsOnly)) {
        return { valid: false, message: 'Invalid mobile number (10-15 digits expected)' }
      }
    }
    return { valid: true }
  }, [paymentMethod, etransferContact, etransferContactType])
  const etransferValid = paymentMethod !== 'etransfer' || etransferValidResult.valid

  const etransferRealtimeError = useMemo(() => {
    if (paymentMethod !== 'etransfer' || !etransferTouched || etransferContact === '') return null
    if (!etransferValidResult.valid) return etransferValidResult.message ?? 'Invalid contact'
    return null
  }, [paymentMethod, etransferTouched, etransferContact, etransferValidResult])

  // Dynamic page title based on selected payment method
  const currentMethodLabel = useMemo(() => {
    const method = PAYMENT_METHODS.find((m) => m.value === paymentMethod)
    return method?.label ?? 'Payment'
  }, [paymentMethod])

  const isoValid = (paymentMethod !== 'wire' && paymentMethod !== 'rtr') || (
    debtorName.trim() !== '' &&
    debtorAccount.trim() !== '' &&
    creditorName.trim() !== '' &&
    creditorAccount.trim() !== ''
  )
  const isValid = amountValid && cardNumValid && cvvValid && expiryValid && isoValid && upiValid && etransferValid

  const handleCountryChange = useCallback((newCountry: string) => {
    setCountry(newCountry)
    const methods = getPaymentMethodsForCountry(newCountry)
    setPaymentMethod((prev) => (methods.includes(prev) ? prev : methods[0] ?? 'card'))
  }, [])

  const validateIso20022ByCountry = useCallback(() => {
    const err: Record<string, string> = {}
    if (country === 'IN') {
      const dIfsc = validateIndiaIfsc(debtorIfsc)
      if (!dIfsc.valid) err.debtorIfsc = dIfsc.message ?? 'Invalid'
      const dAcc = validateIndiaAccount(debtorAccount)
      if (!dAcc.valid) err.debtorAccount = dAcc.message ?? 'Invalid'
      const cIfsc = validateIndiaIfsc(creditorIfsc)
      if (!cIfsc.valid) err.creditorIfsc = cIfsc.message ?? 'Invalid'
      const cAcc = validateIndiaAccount(creditorAccount)
      if (!cAcc.valid) err.creditorAccount = cAcc.message ?? 'Invalid'
    } else if (country === 'US') {
      const dR = validateUsAba(debtorRouting)
      if (!dR.valid) err.debtorRouting = dR.message ?? 'Invalid'
      const dAcc = validateUsAccount(debtorAccount)
      if (!dAcc.valid) err.debtorAccount = dAcc.message ?? 'Invalid'
      const cR = validateUsAba(creditorRouting)
      if (!cR.valid) err.creditorRouting = cR.message ?? 'Invalid'
      const cAcc = validateUsAccount(creditorAccount)
      if (!cAcc.valid) err.creditorAccount = cAcc.message ?? 'Invalid'
    } else if (country === 'GB') {
      const dSc = validateUkSortCode(debtorSortCode)
      if (!dSc.valid) err.debtorSortCode = dSc.message ?? 'Invalid'
      const dAcc = validateUkAccount(debtorAccount)
      if (!dAcc.valid) err.debtorAccount = dAcc.message ?? 'Invalid'
      const cSc = validateUkSortCode(creditorSortCode)
      if (!cSc.valid) err.creditorSortCode = cSc.message ?? 'Invalid'
      const cAcc = validateUkAccount(creditorAccount)
      if (!cAcc.valid) err.creditorAccount = cAcc.message ?? 'Invalid'
    } else if (country === 'CA') {
      const dI = validateCanadaInstitution(debtorInstitution)
      if (!dI.valid) err.debtorInstitution = dI.message ?? 'Invalid'
      const dT = validateCanadaTransit(debtorTransit)
      if (!dT.valid) err.debtorTransit = dT.message ?? 'Invalid'
      const dAcc = validateCanadaAccount(debtorAccount)
      if (!dAcc.valid) err.debtorAccount = dAcc.message ?? 'Invalid'
      const cI = validateCanadaInstitution(creditorInstitution)
      if (!cI.valid) err.creditorInstitution = cI.message ?? 'Invalid'
      const cT = validateCanadaTransit(creditorTransit)
      if (!cT.valid) err.creditorTransit = cT.message ?? 'Invalid'
      const cAcc = validateCanadaAccount(creditorAccount)
      if (!cAcc.valid) err.creditorAccount = cAcc.message ?? 'Invalid'
    } else {
      const dAcc = validateGenericAccount(debtorAccount)
      if (!dAcc.valid) err.debtorAccount = dAcc.message ?? 'Invalid'
      const cAcc = validateGenericAccount(creditorAccount)
      if (!cAcc.valid) err.creditorAccount = cAcc.message ?? 'Invalid'
    }
    if (!debtorName.trim()) err.debtorName = 'Debtor name is required'
    if (!creditorName.trim()) err.creditorName = 'Creditor name is required'
    if (debtorBic && !validateBic(debtorBic).valid) err.debtorBic = validateBic(debtorBic).message ?? 'Invalid BIC'
    if (creditorBic && !validateBic(creditorBic).valid) err.creditorBic = validateBic(creditorBic).message ?? 'Invalid BIC'
    return err
  }, [country, debtorName, debtorAccount, debtorBic, debtorIfsc, debtorRouting, debtorSortCode, debtorInstitution, debtorTransit, creditorName, creditorAccount, creditorBic, creditorIfsc, creditorRouting, creditorSortCode, creditorInstitution, creditorTransit])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setErrors({})
      const newErrors: Record<string, string> = {}

      if (!country) newErrors.country = 'Country is required'
      if (!paymentMethod) newErrors.paymentMethod = 'Payment method is required'
      if (!amountValid) newErrors.amount = 'Enter a valid amount greater than 0'
      if (!currency) newErrors.currency = 'Currency is required'
      if (!originator) newErrors.originator = 'Testing role is required'

      if (paymentMethod === 'card') {
        const raw = normalizeCardNumber(cardNumber)
        if (raw.length < 13) newErrors.cardNumber = 'Card number must be at least 13 digits'
        else if (!luhnCheck(cardNumber)) newErrors.cardNumber = 'Invalid card number (Luhn check failed)'
        if (cvv.length !== cvvLen || !/^\d+$/.test(cvv)) newErrors.cvv = `CVV must be ${cvvLen} digits`
        const expResult = validateExpiry(expiryMonth, expiryYear)
        if (!expResult.valid) newErrors.expiry = expResult.message ?? 'Invalid expiry'
      }

      if (paymentMethod === 'wire' || paymentMethod === 'rtr') {
        const isoErrs = validateIso20022ByCountry()
        Object.assign(newErrors, isoErrs)
      }

      if (paymentMethod === 'upi') {
        const upiResult = validateUpiId(upiId)
        if (!upiResult.valid) newErrors.upiId = upiResult.message ?? 'Invalid UPI ID'
      }

      if (paymentMethod === 'etransfer') {
        if (!etransferValidResult.valid) {
          newErrors.etransferContact = etransferValidResult.message ?? 'Invalid contact'
        }
      }

      setErrors(newErrors)
      if (Object.keys(newErrors).length > 0) return

      // Record payment method usage
      recordMethodUsage(paymentMethod)

      // Generate fresh transaction reference for this submission
      setTxnRef(generateTransactionRef(paymentMethod))

      // Generate fresh order ID for merchant
      if (originator === 'merchant') {
        setOrderId(generateOrderId())
      }

      setIsSubmitting(true)
      setShowResults(false)
    },
    [amountValid, paymentMethod, cardNumber, cvv, cvvLen, expiryMonth, expiryYear, validateIso20022ByCountry, originator, country, currency, upiId, etransferValidResult]
  )

  const handleFlowComplete = useCallback(() => {
    const status = risk === 'normal' ? 'success' : 'failed'
    const feeTotal = risk === 'normal' ? amount * 0.002 + amount * 0.0005 + 0.25 : 0
    const iso20022 =
      paymentMethod === 'wire' || paymentMethod === 'rtr'
        ? {
            debtorName: debtorName.trim(),
            debtorAccount: debtorAccount.trim(),
            debtorBic: debtorBic.trim() || undefined,
            debtorIfsc: country === 'IN' ? debtorIfsc.trim() : undefined,
            debtorRouting: country === 'US' ? debtorRouting.trim() : undefined,
            creditorName: creditorName.trim(),
            creditorAccount: creditorAccount.trim(),
            creditorBic: creditorBic.trim() || undefined,
            creditorIfsc: country === 'IN' ? creditorIfsc.trim() : undefined,
            creditorRouting: country === 'US' ? creditorRouting.trim() : undefined,
            remittanceInfo: remittanceInfo.trim() || undefined,
          }
        : undefined
    const currentPayload = buildMessagePayload(
      paymentMethod,
      country,
      amount,
      currency,
      risk,
      originator,
      orderId,
      txnRef,
      cardNumber,
      cvv,
      expiryMonth,
      expiryYear,
      paymentMethod === 'wire' ? wirePaymentType : undefined,
      iso20022
    )
    // Append UPI/eTransfer data to payload
    if (paymentMethod === 'upi' && upiId) {
      ;(currentPayload.payload as Record<string, unknown>).upiId = upiId.trim()
      ;(currentPayload.payload as Record<string, unknown>).upiUri = buildUpiUri({
        vpa: upiId.trim(),
        amount: amount > 0 ? amount : undefined,
        currency: 'INR',
      })
    }
    if (paymentMethod === 'etransfer' && etransferContact) {
      ;(currentPayload.payload as Record<string, unknown>).etransferContact = etransferContact.trim()
      ;(currentPayload.payload as Record<string, unknown>).etransferContactType = etransferContactType
    }
    addTransaction({
      id: (currentPayload as { messageId: string }).messageId,
      timestamp: new Date().toISOString(),
      rail: paymentMethod,
      paymentMethod,
      country,
      amount,
      currency,
      risk,
      status,
      feeAmount: feeTotal,
      feeCurrency: currency,
      payload: currentPayload,
    })
    logSimulation({
      timestamp: new Date().toISOString(),
      rail: paymentMethod,
      status,
      feeAmount: feeTotal,
      feeCurrency: currency,
      amount,
      currency,
      risk,
    })
    setToast({
      message: status === 'success' ? 'Simulation completed successfully' : 'Simulation failed',
      type: status === 'success' ? 'success' : 'error',
    })
    setShowResults(true)
    setIsSubmitting(false)
  }, [
    risk,
    paymentMethod,
    country,
    amount,
    currency,
    originator,
    orderId,
    txnRef,
    cardNumber,
    cvv,
    expiryMonth,
    expiryYear,
    wirePaymentType,
    debtorName,
    debtorAccount,
    debtorBic,
    debtorIfsc,
    debtorRouting,
    creditorName,
    creditorAccount,
    creditorBic,
    creditorIfsc,
    creditorRouting,
    remittanceInfo,
    upiId,
    etransferContact,
    etransferContactType,
  ])

  const payload = useMemo(() => {
    if (!showResults) return null
    const p = buildMessagePayload(
      paymentMethod,
      country,
      amount,
      currency,
      risk,
      originator,
      orderId,
      txnRef,
      cardNumber,
      cvv,
      expiryMonth,
      expiryYear,
      paymentMethod === 'wire' ? wirePaymentType : undefined,
      paymentMethod === 'wire' || paymentMethod === 'rtr'
        ? {
            debtorName,
            debtorAccount,
            debtorBic: debtorBic || undefined,
            debtorIfsc: country === 'IN' ? debtorIfsc : undefined,
            debtorRouting: country === 'US' ? debtorRouting : undefined,
            creditorName,
            creditorAccount,
            creditorBic: creditorBic || undefined,
            creditorIfsc: country === 'IN' ? creditorIfsc : undefined,
            creditorRouting: country === 'US' ? creditorRouting : undefined,
            remittanceInfo: remittanceInfo || undefined,
          }
        : undefined
    )
    if (paymentMethod === 'upi' && upiId) {
      ;(p.payload as Record<string, unknown>).upiId = upiId.trim()
      ;(p.payload as Record<string, unknown>).upiUri = buildUpiUri({
        vpa: upiId.trim(),
        amount: amount > 0 ? amount : undefined,
        currency: 'INR',
      })
    }
    if (paymentMethod === 'etransfer' && etransferContact) {
      ;(p.payload as Record<string, unknown>).etransferContact = etransferContact.trim()
      ;(p.payload as Record<string, unknown>).etransferContactType = etransferContactType
    }
    return p
  }, [showResults, paymentMethod, country, amount, currency, risk, originator, orderId, txnRef, cardNumber, cvv, expiryMonth, expiryYear, wirePaymentType, debtorName, debtorAccount, debtorBic, debtorIfsc, debtorRouting, creditorName, creditorAccount, creditorBic, creditorIfsc, creditorRouting, remittanceInfo, upiId, etransferContact, etransferContactType])
  const ledgerImpact = showResults ? buildLedgerImpact(amount, currency, risk) : []
  const feeBreakdown = showResults ? buildFeeBreakdown(amount, currency, risk) : []

  const inputBase =
    'w-full rounded-2xl border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-gray-800 dark:text-white dark:border-gray-700'
  const inputError = 'border-red-500'
  const readonlyInput =
    'w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-mono dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700'

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title={`Simulate ${currentMethodLabel}`}
        subtitle={`Configure a ${currentMethodLabel} transaction and view message payload, flow, and ledger impact.`}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <section className="w-full shrink-0 lg:w-[380px]">
          <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <SectionTitle className="mb-4 dark:text-gray-400">Test Payment</SectionTitle>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* 1. "I am Testing as a" (formerly Originator) - now first */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  I am Testing as a {MANDATORY_MARK}
                </label>
                <select
                  value={originator}
                  onChange={(e) => setOriginator(e.target.value)}
                  className={`${inputBase} border-gray-200 dark:border-gray-700 ${errors.originator ? inputError : ''}`}
                  disabled={isSubmitting}
                >
                  {ORIGINATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.originator && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.originator}</p>
                )}
              </div>

              {/* 2. Country */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Country {MANDATORY_MARK}
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className={`${inputBase} border-gray-200 dark:border-gray-700 ${errors.country ? inputError : ''}`}
                  disabled={isSubmitting}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.country}</p>
                )}
              </div>

              {/* Order ID (when testing as Merchant) */}
              {originator === 'merchant' && orderId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Order ID
                    <span className="ml-2 text-xs font-normal text-gray-400">(15-digit, idempotent)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={orderId}
                      readOnly
                      className={readonlyInput}
                    />
                    <button
                      type="button"
                      onClick={() => setOrderId(generateOrderId())}
                      disabled={isSubmitting}
                      className="shrink-0 rounded-xl border border-gray-200 bg-white px-2.5 py-2.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      title="Generate new Order ID"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction Reference */}
              {txnRef && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Transaction Reference
                    <span className="ml-1 text-xs font-normal text-gray-400">({txnRef.label})</span>
                  </label>
                  <input
                    type="text"
                    value={txnRef.referenceId}
                    readOnly
                    className={`${readonlyInput} text-xs`}
                  />
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    Standard: {txnRef.standard}
                  </p>
                  {txnRef.additionalRefs && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(txnRef.additionalRefs).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        >
                          <span className="font-medium">{key}:</span> {val.length > 20 ? val.slice(0, 17) + '...' : val}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setTxnRef(generateTransactionRef(paymentMethod))}
                    disabled={isSubmitting}
                    className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Regenerate reference
                  </button>
                </div>
              )}

              {/* Card fields - only when Credit/Debit Card */}
              {paymentMethod === 'card' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Demo card (optional)
                    </label>
                    <select
                      value={selectedDemoCardId}
                      onChange={(e) => {
                        const id = e.target.value
                        setSelectedDemoCardId(id)
                        if (id) {
                          const demo = getDemoCardById(id)
                          if (demo) {
                            setCardNumber(demo.number)
                            setCvv(demo.cvv)
                            setExpiryMonth(demo.expiryMonth)
                            setExpiryYear(demo.expiryYear)
                            setCardTouched(false)
                            setCvvTouched(false)
                            setExpiryTouched(false)
                          }
                        }
                      }}
                      className={`${inputBase} border-gray-200 dark:border-gray-700`}
                      disabled={isSubmitting}
                    >
                      <option value="">Enter manually</option>
                      {['Visa', 'Mastercard', 'AMEX', 'Diners'].map((net) => (
                        <optgroup key={net} label={net}>
                          {DEMO_CARDS.filter((c) => c.network === net).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.network} •••• {c.last4}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Card number {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={formatCardNumberDisplay(cardNumber)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        const maxLen = getCardNumberMaxLength(raw || cardNumber)
                        setCardNumber(raw.slice(0, maxLen))
                        if (!cardTouched) setCardTouched(true)
                      }}
                      onBlur={() => setCardTouched(true)}
                      placeholder="4111 1111 1111 1111"
                      maxLength={19}
                      className={`${inputBase} border-gray-200 dark:border-gray-700 font-mono tracking-widest ${
                        errors.cardNumber || cardRealtimeError ? inputError : ''
                      }`}
                      disabled={isSubmitting}
                    />
                    {/* Real-time card validation error */}
                    {cardRealtimeError && !errors.cardNumber && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{cardRealtimeError}</p>
                      </div>
                    )}
                    {errors.cardNumber && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{errors.cardNumber}</p>
                      </div>
                    )}
                    {/* Success indicator when card is valid */}
                    {cardTouched && cardNumber && !cardRealtimeError && !errors.cardNumber && cardNumLengthOk && cardLuhnOk && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20">
                        <svg className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Card number is valid (Luhn check passed)</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        CVV {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cvv}
                        onChange={(e) => {
                          setCvv(e.target.value.replace(/\D/g, '').slice(0, cvvLen))
                          if (!cvvTouched) setCvvTouched(true)
                        }}
                        onBlur={() => setCvvTouched(true)}
                        placeholder={cvvLen === 4 ? '1234' : '123'}
                        maxLength={4}
                        className={`${inputBase} border-gray-200 dark:border-gray-700 font-mono ${errors.cvv ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.cvv && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.cvv}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Expiry (MM/YY) {MANDATORY_MARK}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={expiryMonth}
                          onChange={(e) => {
                            setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))
                            if (!expiryTouched) setExpiryTouched(true)
                          }}
                          onBlur={() => setExpiryTouched(true)}
                          placeholder="MM"
                          maxLength={2}
                          className={`${inputBase} border-gray-200 dark:border-gray-700 font-mono text-center ${
                            errors.expiry || expiryRealtimeError ? inputError : ''
                          }`}
                          disabled={isSubmitting}
                        />
                        <span className="self-center text-gray-400">/</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={expiryYear}
                          onChange={(e) => {
                            setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 2))
                            if (!expiryTouched) setExpiryTouched(true)
                          }}
                          onBlur={() => setExpiryTouched(true)}
                          placeholder="YY"
                          maxLength={2}
                          className={`${inputBase} border-gray-200 dark:border-gray-700 font-mono text-center ${
                            errors.expiry || expiryRealtimeError ? inputError : ''
                          }`}
                          disabled={isSubmitting}
                        />
                      </div>
                      {/* Real-time expiry validation error */}
                      {expiryRealtimeError && !errors.expiry && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-red-700 dark:text-red-400">{expiryRealtimeError}</p>
                        </div>
                      )}
                      {errors.expiry && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-red-700 dark:text-red-400">{errors.expiry}</p>
                        </div>
                      )}
                      {/* Success indicator when expiry is valid */}
                      {expiryTouched && expiryMonth.length === 2 && expiryYear.length === 2 && !expiryRealtimeError && !errors.expiry && expiryValid && (
                        <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20">
                          <svg className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">Expiry date is valid</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* UPI fields */}
              {paymentMethod === 'upi' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      UPI ID (VPA) {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value.toLowerCase().replace(/\s/g, ''))
                        if (!upiTouched) setUpiTouched(true)
                      }}
                      onBlur={() => setUpiTouched(true)}
                      placeholder="merchant@upi"
                      className={`${inputBase} border-gray-200 dark:border-gray-700 font-mono ${
                        errors.upiId || upiRealtimeError ? inputError : ''
                      }`}
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      Format: username@handle (e.g. shop@oksbi, john.doe@paytm)
                    </p>
                    {/* Real-time UPI validation error */}
                    {upiRealtimeError && !errors.upiId && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{upiRealtimeError}</p>
                      </div>
                    )}
                    {errors.upiId && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{errors.upiId}</p>
                      </div>
                    )}
                    {/* Success indicator */}
                    {upiTouched && upiId && !upiRealtimeError && !errors.upiId && upiValidResult.valid && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20">
                        <svg className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Valid UPI ID</p>
                      </div>
                    )}
                  </div>

                  {/* UPI QR Code */}
                  {upiValidResult.valid && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowUpiQr(!showUpiQr)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        {showUpiQr ? 'Hide QR Code' : 'Generate UPI QR Code'}
                        <svg
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${showUpiQr ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showUpiQr && upiQrDataUri && (
                        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                          <img
                            src={upiQrDataUri}
                            alt="UPI QR Code"
                            className="h-48 w-48 rounded-lg"
                          />
                          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                            Scan to pay <span className="font-mono font-medium">{upiId}</span>
                          </p>
                          {amount > 0 && (
                            <p className="text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                              Amount: INR {amount.toFixed(2)}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            UPI URI: {buildUpiUri({ vpa: upiId.trim(), amount: amount > 0 ? amount : undefined, currency: 'INR' })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* eTransfer fields */}
              {paymentMethod === 'etransfer' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Send via {MANDATORY_MARK}
                    </label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEtransferContactType('email')
                          setEtransferContact('')
                          setEtransferTouched(false)
                        }}
                        disabled={isSubmitting}
                        className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                          etransferContactType === 'email'
                            ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-300'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEtransferContactType('mobile')
                          setEtransferContact('')
                          setEtransferTouched(false)
                        }}
                        disabled={isSubmitting}
                        className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                          etransferContactType === 'mobile'
                            ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-300'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                      >
                        Mobile
                      </button>
                    </div>
                    <input
                      type={etransferContactType === 'email' ? 'email' : 'tel'}
                      value={etransferContact}
                      onChange={(e) => {
                        setEtransferContact(e.target.value)
                        if (!etransferTouched) setEtransferTouched(true)
                      }}
                      onBlur={() => setEtransferTouched(true)}
                      placeholder={
                        etransferContactType === 'email'
                          ? 'recipient@email.com'
                          : '+1 234 567 8900'
                      }
                      className={`${inputBase} border-gray-200 dark:border-gray-700 ${
                        errors.etransferContact || etransferRealtimeError ? inputError : ''
                      }`}
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      {etransferContactType === 'email'
                        ? 'Recipient email for Interac e-Transfer'
                        : 'Recipient mobile number for Interac e-Transfer'}
                    </p>
                    {/* Real-time eTransfer validation error */}
                    {etransferRealtimeError && !errors.etransferContact && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{etransferRealtimeError}</p>
                      </div>
                    )}
                    {errors.etransferContact && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-2 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 dark:text-red-400">{errors.etransferContact}</p>
                      </div>
                    )}
                    {/* Success indicator */}
                    {etransferTouched && etransferContact && !etransferRealtimeError && !errors.etransferContact && etransferValidResult.valid && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 dark:bg-emerald-900/20">
                        <svg className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          Valid {etransferContactType === 'email' ? 'email address' : 'mobile number'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ISO 20022 / Wire / RTR fields */}
              {(paymentMethod === 'wire' || paymentMethod === 'rtr') && (
                <>
                  {paymentMethod === 'wire' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Payment type {MANDATORY_MARK}
                      </label>
                      <select
                        value={wirePaymentType}
                        onChange={(e) => setWirePaymentType(e.target.value)}
                        className={`${inputBase} border-gray-200 dark:border-gray-700`}
                        disabled={isSubmitting}
                      >
                        {WIRE_PAYMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    ISO 20022 / SWIFT – Debtor (Payer)
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Debtor name {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      value={debtorName}
                      onChange={(e) => setDebtorName(e.target.value)}
                      placeholder="Payer name"
                      className={`${inputBase} ${errors.debtorName ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.debtorName && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorName}</p>
                    )}
                  </div>
                  {country === 'IN' && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Debtor IFSC {MANDATORY_MARK}
                        </label>
                        <input
                          type="text"
                          value={debtorIfsc}
                          onChange={(e) => setDebtorIfsc(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                          placeholder="SBIN0001234"
                          className={`${inputBase} font-mono ${errors.debtorIfsc ? inputError : ''}`}
                          disabled={isSubmitting}
                        />
                        {errors.debtorIfsc && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorIfsc}</p>
                        )}
                      </div>
                    </>
                  )}
                  {country === 'US' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Debtor ABA routing {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={debtorRouting}
                        onChange={(e) => setDebtorRouting(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="021000021"
                        className={`${inputBase} font-mono ${errors.debtorRouting ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.debtorRouting && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorRouting}</p>
                      )}
                    </div>
                  )}
                  {country === 'GB' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Debtor sort code {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        value={debtorSortCode}
                        onChange={(e) => setDebtorSortCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="12-34-56"
                        className={`${inputBase} font-mono ${errors.debtorSortCode ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.debtorSortCode && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorSortCode}</p>
                      )}
                    </div>
                  )}
                  {country === 'CA' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Institution {MANDATORY_MARK}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={debtorInstitution}
                          onChange={(e) => setDebtorInstitution(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="001"
                          className={`${inputBase} font-mono ${errors.debtorInstitution ? inputError : ''}`}
                          disabled={isSubmitting}
                        />
                        {errors.debtorInstitution && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorInstitution}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Transit {MANDATORY_MARK}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={debtorTransit}
                          onChange={(e) => setDebtorTransit(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          placeholder="12345"
                          className={`${inputBase} font-mono ${errors.debtorTransit ? inputError : ''}`}
                          disabled={isSubmitting}
                        />
                        {errors.debtorTransit && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorTransit}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Debtor account {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      value={debtorAccount}
                      onChange={(e) => setDebtorAccount(e.target.value)}
                      placeholder={country === 'IN' ? '9–18 digits' : country === 'US' ? '4–17 digits' : 'Account'}
                      className={`${inputBase} font-mono ${errors.debtorAccount ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.debtorAccount && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorAccount}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Debtor BIC/SWIFT (optional)
                    </label>
                    <input
                      type="text"
                      value={debtorBic}
                      onChange={(e) => setDebtorBic(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                      placeholder="DEUTDEFF"
                      className={`${inputBase} font-mono ${errors.debtorBic ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.debtorBic && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorBic}</p>
                    )}
                  </div>

                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Creditor (Beneficiary)
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Creditor name {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      value={creditorName}
                      onChange={(e) => setCreditorName(e.target.value)}
                      placeholder="Beneficiary name"
                      className={`${inputBase} ${errors.creditorName ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.creditorName && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorName}</p>
                    )}
                  </div>
                  {country === 'IN' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Creditor IFSC {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        value={creditorIfsc}
                        onChange={(e) => setCreditorIfsc(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                        placeholder="HDFC0001234"
                        className={`${inputBase} font-mono ${errors.creditorIfsc ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.creditorIfsc && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorIfsc}</p>
                      )}
                    </div>
                  )}
                  {country === 'US' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Creditor ABA routing {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={creditorRouting}
                        onChange={(e) => setCreditorRouting(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="021000021"
                        className={`${inputBase} font-mono ${errors.creditorRouting ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.creditorRouting && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorRouting}</p>
                      )}
                    </div>
                  )}
                  {country === 'GB' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Creditor sort code {MANDATORY_MARK}
                      </label>
                      <input
                        type="text"
                        value={creditorSortCode}
                        onChange={(e) => setCreditorSortCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="12-34-56"
                        className={`${inputBase} font-mono ${errors.creditorSortCode ? inputError : ''}`}
                        disabled={isSubmitting}
                      />
                      {errors.creditorSortCode && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorSortCode}</p>
                      )}
                    </div>
                  )}
                  {country === 'CA' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Institution {MANDATORY_MARK}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={creditorInstitution}
                          onChange={(e) => setCreditorInstitution(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="001"
                          className={`${inputBase} font-mono ${errors.creditorInstitution ? inputError : ''}`}
                          disabled={isSubmitting}
                        />
                        {errors.creditorInstitution && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorInstitution}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Transit {MANDATORY_MARK}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={creditorTransit}
                          onChange={(e) => setCreditorTransit(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          placeholder="12345"
                          className={`${inputBase} font-mono ${errors.creditorTransit ? inputError : ''}`}
                          disabled={isSubmitting}
                        />
                        {errors.creditorTransit && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorTransit}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Creditor account {MANDATORY_MARK}
                    </label>
                    <input
                      type="text"
                      value={creditorAccount}
                      onChange={(e) => setCreditorAccount(e.target.value)}
                      placeholder="Account number"
                      className={`${inputBase} font-mono ${errors.creditorAccount ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.creditorAccount && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorAccount}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Creditor BIC/SWIFT (optional)
                    </label>
                    <input
                      type="text"
                      value={creditorBic}
                      onChange={(e) => setCreditorBic(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                      placeholder="DEUTDEFF"
                      className={`${inputBase} font-mono ${errors.creditorBic ? inputError : ''}`}
                      disabled={isSubmitting}
                    />
                    {errors.creditorBic && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.creditorBic}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Remittance info (optional)
                    </label>
                    <input
                      type="text"
                      value={remittanceInfo}
                      onChange={(e) => setRemittanceInfo(e.target.value)}
                      placeholder="Payment reference"
                      className={inputBase}
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Transaction amount {MANDATORY_MARK}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  placeholder="0.00"
                  className={`${inputBase} border-gray-200 dark:border-gray-700 ${errors.amount ? inputError : ''}`}
                  disabled={isSubmitting}
                />
                {errors.amount && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.amount}</p>
                )}
              </div>

              {/* Currency */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Currency {MANDATORY_MARK}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`${inputBase} border-gray-200 dark:border-gray-700 ${errors.currency ? inputError : ''}`}
                  disabled={isSubmitting}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.flag} {c.label}
                    </option>
                  ))}
                </select>
                {errors.currency && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.currency}</p>
                )}
              </div>

              {/* Risk */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Risk {MANDATORY_MARK}
                </label>
                <div className="flex gap-2">
                  {(['normal', 'fraud', 'timeout'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRisk(r)}
                      disabled={isSubmitting}
                      className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                        risk === r
                          ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-300'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="mt-2 w-full rounded-2xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {isSubmitting ? 'Running…' : 'Submit'}
              </button>
            </form>
          </CardContainer>
        </section>

        {/* Right: Flow, Payload, Ledger, Fees */}
        <section className="grid min-w-0 flex-1 grid-cols-1 gap-6 overflow-auto lg:grid-cols-2">
          <CardContainer className="flex min-h-0 flex-col p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <SectionTitle className="mb-4 dark:text-gray-400">Payment flow</SectionTitle>
            {isSubmitting && (
              <PaymentFlowAnimation
                risk={risk}
                isRunning={isSubmitting}
                onComplete={handleFlowComplete}
              />
            )}
            {!isSubmitting && !showResults && (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Run a simulation to see the flow.
              </div>
            )}
            {!isSubmitting && showResults && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 py-4 text-center text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                Flow completed. See ledger and fees below.
              </div>
            )}
          </CardContainer>

          <CardContainer className="flex min-h-0 flex-col p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <SectionTitle className="mb-4 dark:text-gray-400">Message payload</SectionTitle>
            {isSubmitting && (
              <div className="flex-1 animate-pulse rounded-2xl bg-gray-800 p-4">
                <div className="h-4 w-3/4 rounded bg-gray-700" />
                <div className="mt-2 h-4 w-1/2 rounded bg-gray-700" />
                <div className="mt-2 h-4 w-5/6 rounded bg-gray-700" />
              </div>
            )}
            {!isSubmitting && payload && (
              <div className="flex-1 min-h-0 overflow-hidden transition-opacity duration-300">
                <PayloadViewer payload={payload} className="h-full" />
              </div>
            )}
            {!isSubmitting && !payload && (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 py-8 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Run a simulation to see the payload.
              </div>
            )}
          </CardContainer>

          <CardContainer className="flex min-h-0 flex-col p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <SectionTitle className="mb-4 dark:text-gray-400">Ledger impact</SectionTitle>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="pb-3 pr-4 font-medium">Account</th>
                    <th className="pb-3 pr-4 text-right font-medium">Debit</th>
                    <th className="pb-3 pr-4 text-right font-medium">Credit</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerImpact.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{row.account}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        {row.debit ? formatAmount(row.debit, row.currency) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        {row.credit ? formatAmount(row.credit, row.currency) : '—'}
                      </td>
                      <td className="py-3 text-gray-500 dark:text-gray-400">{row.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledgerImpact.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No entries yet.</p>
              )}
            </div>
          </CardContainer>

          <CardContainer className="flex min-h-0 flex-col p-6 dark:border-gray-800 dark:bg-gray-900/50">
            <SectionTitle className="mb-4 dark:text-gray-400">Fee breakdown</SectionTitle>
            <div className="flex-1 space-y-2 overflow-auto">
              {feeBreakdown.map((fee, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 ${
                    fee.highlight
                      ? 'bg-[#2563EB]/10 font-semibold text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-300'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300'
                  }`}
                >
                  <span>
                    {fee.name}
                    {fee.pct !== undefined && fee.pct > 0 && (
                      <span className="ml-2 text-xs opacity-80">({fee.pct.toFixed(2)}%)</span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatAmount(fee.amount, fee.currency)}</span>
                </div>
              ))}
            </div>
          </CardContainer>
        </section>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
