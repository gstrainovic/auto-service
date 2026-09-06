import { describe, expect, it } from 'vitest'
import { resolveInstantConfig } from './instant-config'

const CLOUD = '5d413a89-91ad-4a5a-ad71-d2df5fd81d88'
const LOCAL = 'cd7e6912-773b-4ee1-be18-4d95c3b20e9f'

describe('resolveInstantConfig', () => {
  it('local mode: local app id, dev proxy URIs, auth bypass', () => {
    const cfg = resolveInstantConfig({ VITE_INSTANTDB_MODE: 'local', DEV: true })
    expect(cfg).toEqual({
      mode: 'local',
      appId: LOCAL,
      apiURI: '/instant-api',
      websocketURI: 'ws://localhost:8888/runtime/session',
      authBypass: true,
    })
  })

  it('local mode without dev server talks to localhost:8888 directly', () => {
    const cfg = resolveInstantConfig({ VITE_INSTANTDB_MODE: 'local', DEV: false })
    expect(cfg.apiURI).toBe('http://localhost:8888')
  })

  it('selfhosted mode: URIs and app id from env, real auth', () => {
    const cfg = resolveInstantConfig({
      VITE_INSTANTDB_MODE: 'selfhosted',
      VITE_INSTANT_APP_ID: 'app-123',
      VITE_INSTANT_API_URI: 'https://api.example.ch',
      VITE_INSTANT_WS_URI: 'wss://api.example.ch/runtime/session',
      DEV: false,
    })
    expect(cfg).toEqual({
      mode: 'selfhosted',
      appId: 'app-123',
      apiURI: 'https://api.example.ch',
      websocketURI: 'wss://api.example.ch/runtime/session',
      authBypass: false,
    })
  })

  it('selfhosted mode derives the websocket URI from the api URI when not given', () => {
    const cfg = resolveInstantConfig({ VITE_INSTANTDB_MODE: 'selfhosted', VITE_INSTANT_APP_ID: 'app-123', VITE_INSTANT_API_URI: 'https://api.example.ch', DEV: false })
    expect(cfg.websocketURI).toBe('wss://api.example.ch/runtime/session')
  })

  it('selfhosted mode fails loudly without app id or api uri', () => {
    expect(() => resolveInstantConfig({ VITE_INSTANTDB_MODE: 'selfhosted', DEV: false })).toThrow(/VITE_INSTANT_APP_ID/)
    expect(() => resolveInstantConfig({ VITE_INSTANTDB_MODE: 'selfhosted', VITE_INSTANT_APP_ID: 'x', DEV: false })).toThrow(/VITE_INSTANT_API_URI/)
  })

  it('default (cloud) mode keeps the cloud app id, no custom URIs, real auth', () => {
    const cfg = resolveInstantConfig({ DEV: false })
    expect(cfg).toEqual({ mode: 'cloud', appId: CLOUD, apiURI: undefined, websocketURI: undefined, authBypass: false })
  })
})
