import { chatCompletion } from './services/cerebras.mjs'
try {
  const r = await chatCompletion([{ role: 'user', content: 'hi' }], { timeout: 60000 })
  console.log('RESULT:', JSON.stringify(r))
} catch (e) {
  console.error('ERROR:', e.message)
}
