#!/usr/bin/env node

import bcrypt from 'bcryptjs'
import { createInterface } from 'readline'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('🔐 Hivevoice Password Hash Generator')
console.log('This script will generate a bcrypt hash for your admin password.')
console.log('')

rl.question('Enter your admin password: ', async (password) => {
  if (!password || password.length < 8) {
    console.log('❌ Password must be at least 8 characters long')
    process.exit(1)
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    console.log('')
    console.log('✅ Password hash generated successfully!')
    console.log('')
    console.log('Add this to your .env file:')
    console.log(`ADMIN_PASSWORD_HASH=${hash}`)
    console.log('')
    console.log('⚠️  Keep this hash secure and never share it!')
  } catch (error) {
    console.log('❌ Error generating hash:', error.message)
    process.exit(1)
  }
  
  rl.close()
})