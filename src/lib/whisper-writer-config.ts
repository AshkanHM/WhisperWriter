
export interface SelectOption {
  value: string;
  label: string;
}

export const LANGUAGES: SelectOption[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'fa-IR', label: 'فارسی (ایران)' },
  { value: 'fi-FI', label: 'Suomi (Suomi)' },             // Finland
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'nl-NL', label: 'Nederlands (Nederland)' },    // Netherlands
  { value: 'sv-SE', label: 'Svenska (Sverige)' },         // Sweden
  { value: 'da-DK', label: 'Dansk (Danmark)' },           // Denmark
  { value: 'no-NO', label: 'Norsk (Norge)' },             // Norway
  { value: 'pl-PL', label: 'Polski (Polska)' },           // Poland
  { value: 'cs-CZ', label: 'Čeština (Česká republika)' }, // Czech Republic
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'el-GR', label: 'Ελληνικά (Ελλάδα)' },         // Greece
  { value: 'ru-RU', label: 'Русский (Россия)' },          // moved up
  { value: 'tr-TR', label: 'Türkçe (Türkiye)' },
  // Non-European languages after this
  { value: 'ja-JP', label: '日本語 (日本)' },
  { value: 'zh-CN', label: '中文 (中国大陆)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ar-SA', label: 'العربية (السعودية)' },
];

export const FORMATTING_STYLES: SelectOption[] = [
  { value: 'Simple Cleanup', label: 'Simple Cleanup' },
  { value: 'Structured & Clear', label: 'Structured & Clear' },
  { value: 'Casual Messaging & Friendly Chat', label: 'Casual Messaging & Friendly Chat' },
  { value: 'Semi-Formal Work Chat (Professional)', label: 'Semi-Formal Work Chat (Professional)' },
  { value: 'Professional Email', label: 'Professional Email' },
  { value: 'Marketing & Copywriting', label: 'Marketing & Copywriting' },
];

export const DEFAULT_LANGUAGE = 'en-US';
export const DEFAULT_FORMATTING_STYLE = 'Simple Cleanup';

