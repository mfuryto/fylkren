import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { setActiveLanguage, translate, type MessageVariables } from ".";
import type { MessageKey } from "./en";

type Translator = (key: MessageKey, variables?: MessageVariables) => string;
type LocalizationValue = { language: string; translate: Translator };

const LocalizationContext = createContext<LocalizationValue>({
  language: "en",
  translate: (key, variables) => translate("en", key, variables),
});

export function LocalizationProvider({ language, children }: PropsWithChildren<{ language: string }>) {
  setActiveLanguage(language);
  const value = useMemo<LocalizationValue>(() => ({
    language,
    translate: (key, variables) => translate(language, key, variables),
  }), [language]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useTranslation(): Translator {
  return useContext(LocalizationContext).translate;
}

export function useLanguage(): string {
  return useContext(LocalizationContext).language;
}
