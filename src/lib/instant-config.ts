/**
 * InstantDB-Verbindungsmodus (reine Funktion, testbar):
 * - cloud (Default, Auslaufmodell: instantdb.com wird am 31.08.2027 abgeschaltet)
 * - local: E2E/Entwicklung gegen localhost:8888, Auth-Bypass
 * - selfhosted: eigener Server (Hetzner), URIs aus VITE_INSTANT_*, echte Auth
 */
export type InstantMode = 'cloud' | 'local' | 'selfhosted'

export interface InstantEnv {
  VITE_INSTANTDB_MODE?: string
  VITE_INSTANT_APP_ID?: string
  VITE_INSTANT_API_URI?: string
  VITE_INSTANT_WS_URI?: string
  DEV?: boolean
}

export interface InstantConfig {
  mode: InstantMode
  appId: string
  apiURI: string | undefined
  websocketURI: string | undefined
  authBypass: boolean
}

const CLOUD_APP_ID = '5d413a89-91ad-4a5a-ad71-d2df5fd81d88'
const LOCAL_APP_ID = 'cd7e6912-773b-4ee1-be18-4d95c3b20e9f'

function deriveWsUri(apiURI: string): string {
  return `${apiURI.replace(/^http/, 'ws').replace(/\/$/, '')}/runtime/session`
}

export function resolveInstantConfig(env: InstantEnv): InstantConfig {
  const mode = env.VITE_INSTANTDB_MODE

  if (mode === 'local') {
    return {
      mode: 'local',
      appId: LOCAL_APP_ID,
      apiURI: env.DEV ? '/instant-api' : 'http://localhost:8888',
      websocketURI: 'ws://localhost:8888/runtime/session',
      authBypass: true,
    }
  }

  if (mode === 'selfhosted') {
    if (!env.VITE_INSTANT_APP_ID)
      throw new Error('VITE_INSTANT_APP_ID fehlt für VITE_INSTANTDB_MODE=selfhosted')
    if (!env.VITE_INSTANT_API_URI)
      throw new Error('VITE_INSTANT_API_URI fehlt für VITE_INSTANTDB_MODE=selfhosted')
    const apiURI = env.VITE_INSTANT_API_URI.replace(/\/$/, '')
    return {
      mode: 'selfhosted',
      appId: env.VITE_INSTANT_APP_ID,
      apiURI,
      websocketURI: env.VITE_INSTANT_WS_URI || deriveWsUri(apiURI),
      authBypass: false,
    }
  }

  return { mode: 'cloud', appId: CLOUD_APP_ID, apiURI: undefined, websocketURI: undefined, authBypass: false }
}
