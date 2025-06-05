
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

If 'Requested Style' is 'Clean Up Text':
- Focus on correcting grammar, spelling, and punctuation.
- Ensure proper text formatting and sentence structure according to the conventions of the 'Original Language'.
- Do not significantly alter the tone or core message of the original text. The goal is a polished, grammatically correct, and well-formatted version of the input.

If 'Requested Style' is 'Clarify & Restructure Text':
- Go beyond basic cleanup. Rephrase and restructure the text to make it exceptionally clear, well-instructed, and easy to understand.
- Improve sentence flow and coherence. Break down complex sentences if necessary.
- Organize information logically. If the input text contains implicit or explicit lists, rewrite them using bullet points or numbered lists as appropriate to enhance readability and understanding.
- If the input text has distinct conceptual parts, ensure the output clearly divides or segments these parts for improved readability and comprehension. This could involve using paragraph breaks, or other structural cues.
- Ensure the core meaning is preserved but presented in a more effective and digestible manner. The goal is to transform the text into a highly comprehensible and well-organized piece.

If 'Requested Style' is 'Friendly WhatsApp chat':
- Make the output very casual, natural, and friendly, as if talking to a close friend.
- Ensure the tone is conversational, engaging, and light-hearted.
- STRICTLY DO NOT INCLUDE ANY EMOJIS.

If 'Requested Style' is 'Semi-formal Work Chat (Google Chat/ClickUp)':
- Make the output appropriate for professional communication with colleagues and managers, suitable for platforms like Google Chat or ClickUp.
- The text should be clear, concise, well-instructed, and professionally formatted (e.g., using bullet points or numbered lists if appropriate for clarity).
- Maintain a respectful yet approachable tone. Ensure it sounds professional and polished.

If 'Requested Style' is 'Professional Email':
- Format the text as a professional email. Maintain a formal and courteous tone. Ensure appropriate email structure if applicable (e.g., salutation, body, closing), but primarily focus on rephrasing the given text into this style.

If 'Requested Style' is 'Concise Summary':
- Rewrite the text as a brief and concise summary, capturing the main points effectively.

If 'Requested Style' is 'Formal Report Snippet':
- Adapt the text into a snippet suitable for a formal report. Use objective language and a structured, professional tone.

For any other 'Requested Style' not explicitly detailed above, please interpret '{{{style}}}' broadly and rewrite the text to fit its typical conventions, always maintaining the 'Original Language'.

Rewrite the text now.`,
  model: 'googleai/gemini-1.5-flash-latest',
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
