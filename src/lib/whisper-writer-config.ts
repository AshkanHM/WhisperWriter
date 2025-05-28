
export interface SelectOption {
  value: string;
  label: string;
}

export const LANGUAGES: SelectOption[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'fa-IR', label: 'فارسی (ایران)' },
  { value: 'tr-TR', label: 'Türkçe (Türkiye)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'ja-JP', label: '日本語 (日本)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'ru-RU', label: 'Русский (Россия)' },
  { value: 'zh-CN', label: '中文 (中国大陆)' },
  { value: 'ar-SA', label: 'العربية (السعودية)' },
];

export const FORMATTING_STYLES: SelectOption[] = [
  { value: 'Friendly WhatsApp chat', label: 'Friendly WhatsApp Chat' },
  { value: 'Semi-formal Work Chat (Google Chat/ClickUp)', label: 'Semi-formal Work Chat' },
  { value: 'Professional Email', label: 'Professional Email' },
  { value: 'Concise Summary', label: 'Concise Summary' },
  { value: 'Formal Report Snippet', label: 'Formal Report Snippet' },
  { value: 'Creative Story Idea', label: 'Creative Story Idea' },
  { value: 'To-do List', label: 'To-do List' },
];

export const DEFAULT_LANGUAGE = 'en-US';
export const DEFAULT_FORMATTING_STYLE = 'Friendly WhatsApp chat';

