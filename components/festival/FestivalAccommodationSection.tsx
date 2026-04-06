import FallbackImage from "@/components/ui/FallbackImage";
import type { AccommodationOffer } from "@/lib/accommodation/types";
import { outboundClickHref } from "@/lib/outbound/outboundLink";

type Props = {
  offers: AccommodationOffer[];
  festivalId?: string;
};

export default function FestivalAccommodationSection({ offers, festivalId }: Props) {
  if (!offers.length) return null;

  return (
    <section
      className="rounded-2xl border border-black/[0.07] bg-white/90 p-5 shadow-[0_1px_0_rgba(12,14,20,0.04)]"
      aria-labelledby="festival-accommodation-heading"
    >
      <h2 id="festival-accommodation-heading" className="text-xl font-semibold text-[#0c0e14]">
        Настаняване наблизо
      </h2>
      <p className="mt-1 text-sm text-black/55">Предложения в района на събитието (външни партньори).</p>
      <ul className="mt-4 space-y-3">
        {offers.map((offer, index) => (
          <li key={`${offer.url}-${index}`}>
            <a
              href={
                festivalId
                  ? outboundClickHref({
                      targetUrl: offer.url,
                      festivalId,
                      type: "accommodation",
                      source: "festival_detail",
                    })
                  : offer.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 rounded-xl border border-amber-200/30 bg-white p-3 shadow-[0_1px_0_rgba(12,14,20,0.03)] ring-1 ring-amber-100/15 transition hover:border-amber-300/45 hover:shadow-[0_2px_10px_rgba(12,14,20,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
            >
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                {offer.image_url ? (
                  <FallbackImage
                    src={offer.image_url}
                    alt={offer.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                    resetKey={festivalId ? `${festivalId}-${index}` : `${offer.url}-${index}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-wider text-black/35">
                    Място
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/40">{offer.provider}</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-[#0c0e14]">{offer.title}</p>
                {offer.address ? <p className="mt-1 line-clamp-2 text-xs text-black/55">{offer.address}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/60">
                  {offer.distance_text ? <span>{offer.distance_text}</span> : null}
                  {offer.price_text ? <span className="font-semibold text-[#0c0e14]">{offer.price_text}</span> : null}
                  {offer.rating_text ? <span>{offer.rating_text}</span> : null}
                  {offer.review_count != null && offer.review_count > 0 ? (
                    <span className="text-black/45">({offer.review_count} отзива)</span>
                  ) : null}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
