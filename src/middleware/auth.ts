import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

interface AuthContext {
  Variables: {
    userId?: string
    isAuthenticated: boolean
  }
}

export const authMiddleware = createMiddleware<AuthContext>(async (c: Context, next: Next) => {
  const sessionId = getCookie(c, 'session_id')
  
  if (!sessionId) {
    c.set('isAuthenticated', false)
    return c.json({ error: 'Authentication required' }, 401)
  }

  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    console.error('SESSION_SECRET not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  try {
    if (sessionId === sessionSecret) {
      c.set('isAuthenticated', true)
      c.set('userId', 'admin')
      await next()
    } else {
      c.set('isAuthenticated', false)
      return c.json({ error: 'Invalid session' }, 401)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    c.set('isAuthenticated', false)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})

export const optionalAuth = createMiddleware<AuthContext>(async (c: Context, next: Next) => {
  const sessionId = getCookie(c, 'session_id')
  const sessionSecret = process.env.SESSION_SECRET

  if (sessionId && sessionSecret && sessionId === sessionSecret) {
    c.set('isAuthenticated', true)
    c.set('userId', 'admin')
  } else {
    c.set('isAuthenticated', false)
  }
  
  await next()
})