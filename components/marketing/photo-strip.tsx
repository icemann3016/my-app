import Image from "next/image";

import dEdly from "@/public/images/home/gallery-d-edly.jpg";
import golden from "@/public/images/home/gallery-golden-hour.jpg";
import apron from "@/public/images/home/gallery-on-apron.jpg";
import panel from "@/public/images/home/gallery-panel.jpg";
import redWhite from "@/public/images/home/gallery-red-white.jpg";
import wing from "@/public/images/home/gallery-wing-view.jpg";

const photos = [dEdly, golden, panel, redWhite, wing, apron];

/**
 * A band of photos that slowly scrolls sideways (pauses on hover, still with reduced motion).
 * Decorative: the photos are listed twice so the loop is seamless, and hidden from screen readers.
 */
export function PhotoStrip() {
  return (
    <div aria-hidden className="overflow-hidden py-2">
      <div className="photo-strip flex w-max gap-4">
        {[...photos, ...photos].map((photo, i) => (
          <Image
            key={i}
            src={photo}
            alt=""
            placeholder="blur"
            sizes="360px"
            className="h-56 w-80 shrink-0 rounded-xl object-cover shadow-md sm:h-64 sm:w-96"
          />
        ))}
      </div>
    </div>
  );
}
