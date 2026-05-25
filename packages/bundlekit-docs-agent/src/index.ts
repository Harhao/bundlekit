import { mastra } from './mastra'
import type { Agent } from '@mastra/core/agent'
import readline from 'readline'

async function main() {
  console.log('BundleKit Documentation Agent')
  console.log('=============================')
  console.log('Type your question about BundleKit documentation (type "exit" to quit)')
  
  const agent = await mastra.getAgent('docsAgent' as any)
  const typedAgent = agent as unknown as Agent
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  
  const askQuestion = () => {
    rl.question('\n> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('Goodbye!')
        rl.close()
        return
      }
      
      try {
        console.log('Thinking...')
        const response = await typedAgent.generate(input)
        console.log('\n' + response.text)
      } catch (error) {
        console.error('Error:', error)
      }
      
      askQuestion()
    })
  }
  
  askQuestion()
}

main().catch(console.error)