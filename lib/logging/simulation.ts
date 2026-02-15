export interface SimulationLogEntry {
  timestamp: string
  rail: string
  status: string
  feeAmount: number
  feeCurrency: string
  amount: number
  currency: string
  risk: string
}

export function logSimulation(entry: SimulationLogEntry): void {
  const payload = {
    ...entry,
    source: 'payflow-sim',
  }
  if (typeof window !== 'undefined' && (window as unknown as { __PAYFLOW_DEBUG?: boolean }).__PAYFLOW_DEBUG) {
    console.log('[PayFlow Sim]', payload)
  }
  // Future: send to cloud logging
}
