import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turning the business's address into a point on the map.
 *
 * The GPS screen needs somewhere to open before anyone has clocked in. Without
 * this it opens on nothing — a grey box that looks broken on the first morning
 * of using the product, which is exactly the wrong first impression.
 *
 * Nominatim is OpenStreetMap's own geocoder: no key, no bill, same source as
 * the tiles. Its usage policy asks for an identifying User-Agent and no more
 * than one request a second, so the answer is written back to the business row
 * and never asked for again unless the address itself changes.
 */

type Db = SupabaseClient;

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Fails quietly: a map that cannot centre is worth less than a broken page. */
async function lookup(address: string): Promise<Coordinates | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        // Nominatim rejects anonymous traffic, and rightly so.
        "User-Agent": "field-construction/1.0 (construction management platform)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const results = (await response.json()) as { lat?: string; lon?: string }[];
    const first = results?.[0];
    if (!first?.lat || !first?.lon) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * The business's coordinates, geocoding them the first time they are asked for.
 *
 * Re-geocodes when the stored address no longer matches the one the
 * coordinates came from, which is how a business that moves ends up on the map
 * at its new address without anybody having to think about it.
 */
export async function businessCoordinates(db: Db, businessId: string): Promise<Coordinates | null> {
  const { data: business } = await db
    .from("businesses")
    .select("address, latitude, longitude, geocoded_address")
    .eq("id", businessId)
    .maybeSingle();

  const address = business?.address?.trim();
  if (!address) return null;

  if (business!.latitude != null && business!.longitude != null && business!.geocoded_address === address) {
    return { lat: Number(business!.latitude), lng: Number(business!.longitude) };
  }

  const found = await lookup(address);
  if (!found) return null;

  await db
    .from("businesses")
    .update({ latitude: found.lat, longitude: found.lng, geocoded_address: address })
    .eq("id", businessId);

  return found;
}
