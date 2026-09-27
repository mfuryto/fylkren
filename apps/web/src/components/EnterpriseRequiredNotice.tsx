export function EnterpriseRequiredNotice({ children }: { children: string }) {
  return <section className="enterprise-required-notice" role="note">
    <div>
      <h2>Krever Enterpriselisens</h2>
      <p>{children}</p>
    </div>
    <a className="primary-button" href="#/license">Åpne Lisens</a>
  </section>;
}
