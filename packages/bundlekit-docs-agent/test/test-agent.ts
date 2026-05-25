import { mastra } from '../src/mastra'

async function testAgent() {
  console.log('Testing BundleKit Documentation Agent...\n')
  
  const agent = await mastra.getAgent('docsAgent' as any)
  
  const testQuestions = [
    'How do I create a new BundleKit project?',
    'What bundlers are supported?',
    'How do I configure BundleKit?',
  ]
  
  for (const question of testQuestions) {
    console.log(`Question: ${question}`)
    try {
      const response = await agent.generate(question)
      console.log(`Answer: ${response.text}`)
      console.log('---')
    } catch (error) {
      console.log(`Error: ${error}`)
    }
  }
  
  console.log('✅ Agent test completed')
}

testAgent()