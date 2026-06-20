export interface ServiceSection {
  title: {
    ko: string;
    en: string;
  };
  content: {
    ko: string;
    en: string;
  };
  iconName: string;
  techDetails?: {
    standard: string;
    summary: {
      ko: string;
      en: string;
    };
  };
}

export interface MissionSection {
  title: {
    ko: string;
    en: string;
  };
  content: {
    ko: string;
    en: string;
  };
  iconName: string;
}

export interface TranslationKey {
  ko: string;
  en: string;
}

export interface TranslationDictionary {
  [key: string]: TranslationKey;
}
