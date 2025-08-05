import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { optionalAuth } from '../middleware/auth.js'

const auth = new Hono()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json')
  
  const adminUsername = process.env.ADMIN_USERNAME
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
  
  if (!adminUsername || !adminPasswordHash) {
    console.error('Admin credentials not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }
  
  try {
    if (username !== adminUsername) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const isValidPassword = await bcrypt.compare(password, adminPasswordHash)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const sessionId = process.env.SESSION_SECRET || uuidv4()
    
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    return c.json({ 
      message: 'Login successful',
      user: { username: adminUsername }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

auth.post('/logout', async (c) => {
  deleteCookie(c, 'session_id')
  return c.json({ message: 'Logout successful' })
})

auth.get('/me', optionalAuth, async (c) => {
  const isAuthenticated = c.get('isAuthenticated')
  
  if (!isAuthenticated) {
    return c.json({ authenticated: false })
  }
  
  return c.json({ 
    authenticated: true,
    user: { username: process.env.ADMIN_USERNAME }
  })
})

export default auth