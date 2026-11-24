import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { randomBytes, timingSafeEqual } from 'node:crypto';

function iguales(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function crearOAuthGoogle({ entorno = process.env, cliente } = {}) {
  if (!entorno.GOOGLE_CLIENT_ID || !entorno.GOOGLE_CLIENT_SECRET || !entorno.APP_URL) {
    throw new Error('Falta configurar OAuth de Google.');
  }
  const origen = new URL(entorno.APP_URL);
  if (origen.username || origen.password || origen.pathname !== '/' || origen.search || origen.hash ||
      (origen.protocol !== 'https:' &&
       !(entorno.NODE_ENV !== 'production' && origen.protocol === 'http:' && origen.hostname === 'localhost'))) {
    throw new Error('APP_URL no es válida para OAuth.');
  }
  const redirectUri = new URL('/api/auth/google/callback', origen).href;
  cliente ??= new OAuth2Client(entorno.GOOGLE_CLIENT_ID, entorno.GOOGLE_CLIENT_SECRET, redirectUri);

  return {
    async iniciar(emailVincular) {
      const { codeVerifier, codeChallenge } = await cliente.generateCodeVerifierAsync();
      const intento = {
        state: randomBytes(32).toString('hex'),
        nonce: randomBytes(32).toString('hex'),
        codeVerifier,
        caduca: Date.now() + 10 * 60 * 1000,
        emailVincular
      };
      const url = cliente.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        access_type: 'online',
        prompt: 'select_account',
        state: intento.state,
        nonce: intento.nonce,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256
      });
      return { intento, url };
    },

    async completar(query, intento) {
      if (!intento || !Number.isFinite(intento.caduca) || intento.caduca <= Date.now() ||
          !iguales(query.state, intento.state) || query.error ||
          typeof query.code !== 'string' || !query.code || !intento.codeVerifier) {
        throw new Error('El acceso con Google ha caducado o no es válido.');
      }
      const { tokens } = await cliente.getToken({
        code: query.code, codeVerifier: intento.codeVerifier, redirect_uri: redirectUri
      });
      if (!tokens.id_token) throw new Error('Google no devolvió una identidad.');
      const ticket = await cliente.verifyIdToken({
        idToken: tokens.id_token, audience: entorno.GOOGLE_CLIENT_ID
      });
      const perfil = ticket.getPayload();
      if (!perfil || !iguales(perfil.nonce, intento.nonce)) {
        throw new Error('La respuesta de Google no pertenece a este acceso.');
      }
      // No se guardan access tokens, refresh tokens ni ID tokens.
      return perfil;
    }
  };
}
