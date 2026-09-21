import { describe, expect, it } from 'vitest'
import { buildSignupNotice } from './signup-notice'

const now = new Date('2026-09-21T06:00:00.000Z')

describe('buildSignupNotice', () => {
  it('meldet Nutzer, die noch nicht gemeldet sind, in einer Mail', () => {
    const notice = buildSignupNotice({
      users: [{ id: 'u1', email: 'a@b.ch' }, { id: 'u2', email: 'c@d.ch' }],
      settings: [],
      now,
    })
    expect(notice!.userIds).toEqual(['u1', 'u2'])
    expect(notice!.subject).toBe('Wartungsheft: 2 neue Anmeldungen')
    expect(notice!.text).toContain('a@b.ch')
    expect(notice!.text).toContain('c@d.ch')
    expect(notice!.text).toContain('Konten insgesamt: 2')
  })

  it('überspringt bereits gemeldete Nutzer', () => {
    const notice = buildSignupNotice({
      users: [{ id: 'u1', email: 'a@b.ch' }, { id: 'u2', email: 'c@d.ch' }],
      settings: [{ creatorId: 'u1', signupNoticeAt: '2026-09-20T06:00:00.000Z' }],
      now,
    })
    expect(notice!.userIds).toEqual(['u2'])
    expect(notice!.subject).toBe('Wartungsheft: neue Anmeldung')
    expect(notice!.text).not.toContain('a@b.ch')
  })

  it('schweigt, wenn niemand neu ist', () => {
    const notice = buildSignupNotice({
      users: [{ id: 'u1', email: 'a@b.ch' }],
      settings: [{ creatorId: 'u1', signupNoticeAt: '2026-09-20T06:00:00.000Z' }],
      now,
    })
    expect(notice).toBeNull()
  })

  it('meldet Konten ohne E-Mail mit ihrer ID', () => {
    const notice = buildSignupNotice({ users: [{ id: 'u9', email: null }], settings: [], now })
    expect(notice!.text).toContain('u9')
  })
})
