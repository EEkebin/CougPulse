import crypto from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encryptSubject(name: string, descriptor: Float32Array): { data: Uint8Array; iv: Uint8Array } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const plain = Buffer.from(JSON.stringify({ name, descriptor: Array.from(descriptor) }))
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
  return {
    data: Uint8Array.from(Buffer.concat([ciphertext, cipher.getAuthTag()])),
    iv: Uint8Array.from(iv),
  }
}

export function decryptSubject(data: Buffer | Uint8Array, iv: Buffer | Uint8Array): { name: string; descriptor: Float32Array } {
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const i = Buffer.isBuffer(iv) ? iv : Buffer.from(iv)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, i)
  decipher.setAuthTag(d.subarray(d.length - 16))
  const plain = Buffer.concat([decipher.update(d.subarray(0, d.length - 16)), decipher.final()])
  const parsed = JSON.parse(plain.toString('utf8'))
  return { name: parsed.name, descriptor: new Float32Array(parsed.descriptor) }
}
