
'use server';

/**
 * @fileOverview This file defines a Genkit flow for formatting text based on user-selected styles,
 * while preserving the original language of the text.
 *
 * - formatText - A function that formats the input text based on the specified style and language.
 * - FormatTextInput - The input type for the formatText function, including the text to format, the desired style, and the language.
 * - FormatTextOutput - The return type for the formatText function, which contains the formatted text.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormatTextInputSchema = z.object({
  text: z.string().describe('The text to be formatted.'),
  style: z.string().describe('The desired formatting style (e.g., Clean Up Text, Clarify & Restructure Text, Friendly WhatsApp chat, Professional Email).'),
  language: z.string().optional().describe('The language of the input text (e.g., en-US, fa-IR). The output should be in this language.'),
});
export type FormatTextInput = z.infer<typeof FormatTextInputSchema>;

const FormatTextOutputSchema = z.object({
  formattedText: z.string().describe('The text formatted according to the specified style and language.'),
});
export type FormatTextOutput = z.infer<typeof FormatTextOutputSchema>;

export async function formatText(input: FormatTextInput): Promise<FormatTextOutput> {
  return formatTextFlow(input);
}

const formatTextPrompt = ai.definePrompt({
  name: 'formatTextPrompt',
  input: {schema: FormatTextInputSchema},
  output: {schema: FormatTextOutputSchema},
  prompt: `You are a text formatting expert. Your primary goal is to rewrite the provided text according to the specified 'Requested Style', ensuring the output strictly remains in the 'Original Language'.

Input Text: {{{text}}}
Requested Style: {{{style}}}
{{#if language}}
Original Language: {{{language}}}
Instruction: The output text MUST be in this language ({{{language}}}). Do not translate.
{{else}}
Instruction: The output text MUST be in the same language as the input. Do not translate the text.
{{/if}}

Please apply the specific guidelines for the 'Requested Style':

If 'Requested Style' is 'Simple Cleanup':
- Focus on correcting grammar, spelling, and punctuation.
- Ensure proper text formatting and sentence structure according to the conventions of the 'Original Language'.
- Do not significantly alter the tone or core message of the original text. The goal is a polished, grammatically correct, and well-formatted version of the input without changing its original tone.

If 'Requested Style' is 'Structured & Clear':
- Go beyond basic cleanup. Rephrase and restructure the text to make it exceptionally clear, well-instructed, and easy to understand.
- Improve sentence flow and coherence. Break down complex sentences if necessary.
- Organize information logically. If the input text contains implicit or explicit lists, rewrite them using bullet points or numbered lists as appropriate to enhance readability and understanding.
- If the input text has distinct conceptual parts, clearly divide or segment these parts for improved readability and comprehension (e.g., using paragraph breaks or other structural cues).
- Ensure the core meaning and tone are preserved but presented in a more effective and digestible manner.

If 'Requested Style' is 'Casual Messaging & Friendly Chat':
- Rewrite in a friendly, relaxed, casual, and conversational tone as if chatting with a friend.
- Ensure the tone is engaging and approachable.
- STRICTLY DO NOT INCLUDE ANY EMOJIS.

If 'Requested Style' is 'Semi-Formal Work Chat (Professional)':
- Make the output appropriate for professional communication with colleagues and managers, suitable for workplace messaging platforms.
- The text should be clear, concise, and professionally formatted (e.g., using bullet points or numbered lists if appropriate for clarity).
- Maintain a respectful yet approachable tone. Ensure it sounds professional and polished.

If 'Requested Style' is 'Professional Email':
- Format the text as a professional email. Maintain a formal and courteous tone. Ensure appropriate email structure if applicable (e.g., salutation, body, closing).
- Rewrite the message into a formal, respectful, and business-ready email.
- Keep the tone professional and courteous.

If 'Requested Style' is 'Marketing & Copywriting':
- Rewrite the text as if crafted by a professional, high-converting copywriter.
- Focus on engaging the reader while keeping the tone persuasive and audience-focused.
- Use clear, benefit-driven language that motivates the reader to take action.
- Adapt the style to feel natural for marketing content (e.g., sales page, ad copy, promotional message).
- Ensure the output is concise, impactful, and aligns with best practices for effective copywriting.
- Do not add emojis unless the original text contains them.

For any other 'Requested Style' not explicitly detailed above, please interpret '{{{style}}}' broadly and rewrite the text to fit its typical conventions, always maintaining the 'Original Language'.

Rewrite the text now.`,
  model: 'googleai/gemini-1.5-pro-latest',
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const formatTextFlow = ai.defineFlow(
  {
    name: 'formatTextFlow',
    inputSchema: FormatTextInputSchema,
    outputSchema: FormatTextOutputSchema,
  },
  async input => {
    const {output} = await formatTextPrompt(input);
    return output!;
  }
);
