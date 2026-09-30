import { useTranslation } from "../localization/LocalizationProvider";

export function EnterpriseRequiredNotice({ children }: { children: string }) {
  const t = useTranslation();
  return <section className="enterprise-required-notice" role="note">
    <div>
      <h2>{t("enterpriseRequired")}</h2>
      <p>{children}</p>
    </div>
    <a className="primary-button" href="#/license">{t("openLicense")}</a>
  </section>;
}
