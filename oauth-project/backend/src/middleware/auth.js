import { expressjwt as jwt } from 'express-jwt'
import jwksRsa from 'jwks-rsa'

const issuer = 'http://localhost:8080/realms/security-lab'
const audience = 'account'

const jwksUri = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`

const authMiddleware = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri,
  }),
  audience: audience,
  issuer: issuer,
  algorithms: ['RS256'],
})

export default authMiddleware
