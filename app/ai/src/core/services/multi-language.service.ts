/**
 * VYENFITA Multi-Language Support Service
 * 
 * Manages multiple languages
 * - Language detection
 * - Translation
 * - Localization
 * - Language preferences
 * 
 * @version 1.0.0
 */

import { AIService } from './ai.service';
import { ChatMessage } from '../interfaces/ai-provider.interface';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
}

export interface LocalizedContent {
  id: string;
  key: string;
  translations: Record<string, string>;
  context?: string;
  updatedAt: Date;
}

export interface UserLanguagePreference {
  userId: string;
  preferredLanguage: string;
  fallbackLanguage: string;
  updatedAt: Date;
}

export class MultiLanguageService {
  private aiService: AIService;
  private languages: Map<string, Language>;
  private translations: Map<string, LocalizedContent>;
  private userPreferences: Map<string, UserLanguagePreference>;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.languages = new Map();
    this.translations = new Map();
    this.userPreferences = new Map();

    // Initialize default languages
    this.initializeDefaultLanguages();
  }

  /**
   * Initialize default languages
   */
  private initializeDefaultLanguages(): void {
    const defaultLanguages: Language[] = [
      { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isDefault: true },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', isDefault: false },
      { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', isDefault: false },
      { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', isDefault: false },
      { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', isDefault: false },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', isDefault: false },
      { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', isDefault: false },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', isDefault: false },
    ];

    for (const lang of defaultLanguages) {
      this.languages.set(lang.code, lang);
    }
  }

  /**
   * Get all supported languages
   */
  getLanguages(): Language[] {
    return Array.from(this.languages.values());
  }

  /**
   * Get a specific language
   */
  getLanguage(code: string): Language | undefined {
    return this.languages.get(code);
  }

  /**
   * Add a new language
   */
  addLanguage(language: Language): void {
    this.languages.set(language.code, language);
  }

  /**
   * Translate text to a target language
   */
  async translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    if (targetLanguage === sourceLanguage || targetLanguage === 'en') {
      return text;
    }

    const systemPrompt = `You are VYENFITA Translation Agent.
Translate the following text to ${targetLanguage}.
Output only the translated text, nothing else.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.3,
      maxTokens: 4096,
    });

    return response.choices[0].message.content;
  }

  /**
   * Localize content for a specific language
   */
  async localize(content: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'en') {
      return content;
    }

    const lang = this.languages.get(targetLanguage);
    if (!lang) {
      return content;
    }

    // Check if translation exists
    const key = this.generateTranslationKey(content);
    const existing = this.translations.get(key);
    if (existing && existing.translations[targetLanguage]) {
      return existing.translations[targetLanguage];
    }

    // Translate
    const translated = await this.translate(content, targetLanguage);

    // Cache translation
    const localizedContent: LocalizedContent = {
      id: key,
      key,
      translations: {
        en: content,
        [targetLanguage]: translated,
      },
      updatedAt: new Date(),
    };

    this.translations.set(key, localizedContent);

    return translated;
  }

  /**
   * Generate a translation key
   */
  private generateTranslationKey(text: string): string {
    return `key_${Buffer.from(text).toString('base64').substring(0, 20)}`;
  }

  /**
   * Set user language preference
   */
  setUserPreference(
    userId: string,
    preferredLanguage: string,
    fallbackLanguage: string = 'en'
  ): UserLanguagePreference {
    const preference: UserLanguagePreference = {
      userId,
      preferredLanguage,
      fallbackLanguage,
      updatedAt: new Date(),
    };

    this.userPreferences.set(userId, preference);
    return preference;
  }

  /**
   * Get user language preference
   */
  getUserPreference(userId: string): UserLanguagePreference | undefined {
    return this.userPreferences.get(userId);
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    const systemPrompt = `You are VYENFITA Language Detection Agent.
Detect the language of the following text.
Output only the ISO language code (e.g., 'en', 'id', 'es'), nothing else.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const response = await this.aiService.chat({
      messages,
      temperature: 0.1,
      maxTokens: 10,
    });

    const detected = response.choices[0].message.content.trim().toLowerCase();
    if (this.languages.has(detected)) {
      return detected;
    }

    return 'en'; // Default fallback
  }

  /**
   * Get translation statistics
   */
  getTranslationStats(): {
    totalTranslations: number;
    languages: Record<string, number>;
    totalKeys: number;
  } {
    const stats = {
      totalTranslations: 0,
      languages: {} as Record<string, number>,
      totalKeys: this.translations.size,
    };

    for (const translation of this.translations.values()) {
      for (const [lang, _] of Object.entries(translation.translations)) {
        if (lang !== 'en') {
          stats.totalTranslations++;
          stats.languages[lang] = (stats.languages[lang] || 0) + 1;
        }
      }
    }

    return stats;
  }
       }
