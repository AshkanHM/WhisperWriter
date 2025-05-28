'use server';

/**
 * @fileOverview This file defines a Genkit flow for formatting text based on user-selected styles.
 *
 * - formatText - A function that formats the input text based on the specified style.
 * - FormatTextInput - The input type for the formatText function, including the text to format and the desired style.
 * - FormatTextOutput - The return type for the formatText function, which contains the formatted text.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormatTextInputSchema = z.object({
  text: z.string().describe('The text to be formatted.'),
  style: z.string().describe('The desired formatting style (e.g., friendly WhatsApp chat, professional email).'),
});
export type FormatTextInput = z.infer<typeof FormatTextInputSchema>;

const FormatTextOutputSchema = z.object({
  formattedText: z.string().describe('The text formatted according to the specified style.'),
});
export type FormatTextOutput = z.infer<typeof FormatTextOutputSchema>;

export async function formatText(input: FormatTextInput): Promise<FormatTextOutput> {
  return formatTextFlow(input);
}

const formatTextPrompt = ai.definePrompt({
  name: 'formatTextPrompt',
  input: {schema: FormatTextInputSchema},
  output: {schema: FormatTextOutputSchema},
  prompt: `You are a text formatting expert. Please rewrite the following text in the style of a {{{style}}}.\n\nText: {{{text}}}`,
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
