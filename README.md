# Whisper Writer

Whisper Writer is an advanced web application designed for real-time audio transcription and AI-powered text enhancement. Built with Next.js, React, and Genkit, it provides a seamless experience for capturing voice notes and transforming them into polished, formatted text suitable for various use cases.

The application features a modern, glassy UI with custom-styled components that are both intuitive and visually appealing.

## Key Features

- **Real-Time Audio Recording & Transcription**:
  - Record audio directly in the browser with a multi-state recording button (idle, recording, paused).
  - Transcribe audio into text using Google's Gemini 1.5 Pro model via Genkit.
  - The transcribed text appears in an editable textarea, allowing for manual corrections and additions.

- **Multi-Language Support**:
  - A streamlined UI for quickly switching between primary languages (English and Persian).
  - A comprehensive language modal allows users to select from a wide range of languages to ensure high transcription accuracy.

- **AI-Powered Text Formatting**:
  - Enhance and re-style your transcribed text using a powerful Genkit AI flow.
  - Choose from a variety of formatting styles, including:
    - Simple Cleanup
    - Structured & Clear
    - Casual Messaging
    - Professional Email
    - Marketing Copywriting
  - The AI preserves the original language of the text while applying the selected style.

- **Modern & Interactive UI**:
  - Built with **Tailwind CSS** and **ShadCN UI** components.
  - Features custom-designed, "glassy" interface elements like cards, buttons, and modals for a futuristic aesthetic.
  - Dynamic header images that change based on the application's state (recording, transcribing, idle).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React, TypeScript, Tailwind CSS, ShadCN UI
- **Generative AI**: Google Genkit with the Google AI (Gemini) plugin
- **State Management**: React Hooks (`useState`, `useCallback`, etc.)

## Getting Started

To get started with the application, simply run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

To run the Genkit flows for local development and inspection, use:

```bash
npm run genkit:dev
```

This will start the Genkit development server, allowing you to interact with the AI flows directly.
