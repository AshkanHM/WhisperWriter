
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
  style: z.string().describe('The desired formatting style (e.g., friendly WhatsApp chat, professional email).'),
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
  prompt: `You are a text formatting expert. Please rewrite the following text in the style of a {{{style}}}.
{{#if language}}
IMPORTANT: The output text MUST be in the same language as the input, which is {{{language}}}. Do not translate the text.
{{else}}
IMPORTANT: The output text MUST be in the same language as the input. Do not translate the text.
{{/if}}

IMPORTANT:
- If the style is 'Friendly WhatsApp chat', ensure the output is casual and conversational AND STRICTLY DOES NOT INCLUDE ANY EMOJIS.
- If the style is 'Semi-formal Work Chat (Google Chat/ClickUp)', make it appropriate for professional but slightly informal communication with colleagues and managers, suitable for platforms like Google Chat or ClickUp. It should be clear, concise, and maintain a respectful tone.

For all other styles, adhere to their typical conventions while maintaining the original language.

Text: {{{text}}}`,
  model: 'googleai/gemini-2.0-flash',
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
