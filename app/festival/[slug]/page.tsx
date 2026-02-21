import { notFound } from "next/navigation";
import FestivalHero from "@/components/FestivalHero";
import FestivalProgram from "@/components/FestivalProgram";
import FestivalGoodToKnow from "@/components/FestivalGoodToKnow";
import FestivalLocation from "@/components/FestivalLocation";
import FestivalHighlights from "@/components/FestivalHighlights";
import FestivalGrid from "@/components/FestivalGrid";
import { getCityFestivals, getFestivalBySlug } from "@/lib/queries";
import { buildFestivalJsonLd, festivalMeta, getBaseUrl } from "@/lib/seo";

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getFestivalBySlug(params.slug);
  if (!data) return {};
  const meta = festivalMeta(data.festival);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/festival/${params.slug}`,
    },
  };
}

export default async function FestivalDetailPage({ params }: { params: { slug: string } }) {
  const data = await getFestivalBySlug(params.slug);
  if (!data) return notFound();

  const jsonLd = buildFestivalJsonLd(data.festival);
  const moreInCity = data.festival.city
    ? await getCityFestivals(data.festival.city, { city: [data.festival.city], free: data.festival.is_free ?? true }, 1, 6)
    : null;

  return (
    <div className="container-page space-y-12 py-10">
      <FestivalHero festival={data.festival} />

      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {data.festival.description && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">About</h2>
              <p
                className="text-sm leading-7 text-muted"
                style={{ display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {data.festival.description}
              </p>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Read more</summary>
                <p className="mt-4 text-sm leading-7 text-muted">{data.festival.description}</p>
              </details>
            </section>
          )}

          <FestivalHighlights festival={data.festival} />
          <FestivalProgram days={data.days} items={data.scheduleItems} />
          <FestivalLocation festival={data.festival} />
          <FestivalGoodToKnow festival={data.festival} />
        </div>

        <aside className="space-y-6">
          {data.media.length ? (
            <div className="grid gap-4">
              {data.media.slice(0, 3).map((media) => (
                <img
                  key={media.id}
                  src={media.url}
                  alt={data.festival.title}
                  className="h-40 w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="rounded-2xl border border-ink/10 bg-white/80 p-5 text-sm text-muted">
            <p className="font-semibold text-ink">Shareable link</p>
            <p>{`${getBaseUrl()}/festival/${data.festival.slug}`}</p>
          </div>
        </aside>
      </div>

      {moreInCity?.data?.length ? (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">More festivals in {data.festival.city}</h2>
          <FestivalGrid festivals={moreInCity.data.filter((festival) => festival.slug !== data.festival.slug)} />
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
