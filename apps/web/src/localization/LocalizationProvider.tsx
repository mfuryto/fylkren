import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { setActiveLanguage, translate, type MessageVariables } from ".";
import type { MessageKey } from "./en";

type Translator = (key: MessageKey, variables?: MessageVariables) => string;

const LocalizationContext = createContext<Translator>((key, variables) =>
  translate("en", key, variables));

export function LocalizationProvider({ language, children }: PropsWithChildren<{ language: string }>) {
  setActiveLanguage(language);
  const translator = useMemo<Translator>(() =>
    (key, variables) => translate(language, key, variables), [language]);
  return <LocalizationContext.Provider value={translator}>{children}</LocalizationContext.Provider>;
}

export function useTranslation(): Translator {
  return useContext(LocalizationContext);
}
