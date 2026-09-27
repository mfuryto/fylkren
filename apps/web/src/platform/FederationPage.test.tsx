import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FederationPage } from "./FederationPage";

describe("federation administration", () => {
  it("shows the complete GUI and contextual help", () => {
    const html = renderToStaticMarkup(<FederationPage canManage />);
    expect(html).toContain("Hjelp");
    expect(html).toContain("Denne instansen");
    expect(html).toContain("Legg til motpart");
    expect(html).toContain("Motparter og tilkobling");
    expect(html).toContain("aktive toppnivå-sites");
    expect(html).not.toContain("Site-tillatelser");
    expect(html).toContain("Oppdragsrouting");
    expect(html).toContain("Hent signert identitet");
    expect(html).not.toContain("Gå til Lisens");
  });

  it("keeps federation visible behind one Enterprise notice", () => {
    const html = renderToStaticMarkup(<FederationPage canManage={false} />);
    expect(html).toContain("Krever Enterpriselisens");
    expect(html).toContain("Opprett federeringsnøkkel");
    expect(html).toContain("Hent signert identitet");
    expect(html).toContain("Oppdragsrouting");
    expect(html.match(/Krever Enterpriselisens/g)).toHaveLength(1);
  });
});
