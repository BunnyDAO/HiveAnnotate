import { describe, it, expect } from 'vitest'
import { isAllowedExternal } from './allowedLinks.ts'

describe('links the app will open', () => {
  it.each(['https://hiveop.io', 'https://hiveop.io/pricing', 'https://www.hiveop.io/'])('allows %s', (url) => {
    expect(isAllowedExternal(url)).toBe(true)
  })

  it.each([
    ['http://hiveop.io', 'not https'],
    ['https://evil.example', 'another host'],
    ['https://hiveop.io.evil.example', 'a lookalike host'],
    ['https://user:pass@hiveop.io', 'credentials in the URL'],
    ['file:///etc/passwd', 'a local file'],
    ['javascript:alert(1)', 'script'],
    ['not a url', 'garbage'],
  ])('refuses %s (%s)', (url) => {
    expect(isAllowedExternal(url)).toBe(false)
  })
})
