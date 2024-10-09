import { Configuration, OpenAIApi } from 'openai-edge'
import { OpenAIStream, StreamingTextResponse } from 'ai'

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(config)

export const runtime = 'edge'

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const response = await openai.createChatCompletion({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant that recognizes events from text and outputs them in JSON format. Each event should have a title, date (YYYY-MM-DD), and time (HH:MM).

        If an event is recurring, include a 'recurrence' field with the recurrence rule (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR" for an event that occurs every Monday, Wednesday, and Friday).

        If an event has an alarm, include an 'alarm' field with the number of minutes before the event that the alarm should trigger.

        Output the events as a JSON array. Do not include markdown formatting in the output.`,
      },
      {
        role: 'user',
        content: prompt
      }
    ],
  })

  const stream = OpenAIStream(response)
  return new StreamingTextResponse(stream)
}
