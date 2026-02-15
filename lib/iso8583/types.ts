/**
 * ISO 8583 JSON message representation.
 * DE4 (Amount) is in minor units (cents) per ISO 8583.
 * DE7 is transmission datetime as MMDDhhmmss (10 digits).
 * DE39 is present in response; null for request.
 */
export interface Iso8583Message {
  MTI: string
  DE2: string
  DE3: string
  DE4: number
  DE7: string
  DE11: string
  DE39: string | null
}
