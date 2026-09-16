import { PageHeader, SeoArticle } from "./LatestReleasesPage";
import ActivityBoard from "../components/casino/ActivityBoard";
import { useProviders } from "../lib/catalogue";
import { navigate } from "../lib/router";
import seoHtml from "../data/seo-providers.html?raw";

/** Providers browse page — reference `/casino/providers`: header + four-column logo grid + bets board + SEO copy. */
export default function ProvidersPage() {
  const { providers } = useProviders();

  return (
    <div>
      <PageHeader title="Providers" />
      <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md2 LayoutContainer_column">
        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement GameProviders_cardGridElement">
            {providers.map((p) => (
              <div key={p.slug} className="ProviderCard_ProviderCardWrapper" style={{ cursor: "pointer" }}>
                <a href={`/casino/providers/${p.slug}`} onClick={(e) => { e.preventDefault(); navigate(`/casino/providers/${p.slug}`); }}>
                  <div className="ProviderCard_providerCardBlock">
                    <div className="ProviderCard_providerCardElement">
                      <img alt={p.label || p.name} className="nimg-fill nimg-contain" src={p.img} />
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ActivityBoard hideTabs={["race"]} />
      <SeoArticle html={seoHtml} />
    </div>
  );
}
