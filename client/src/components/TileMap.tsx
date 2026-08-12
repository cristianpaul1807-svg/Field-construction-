import { useEffect, useLayoutEffect, useRef, useState } from "react";

// A map with no API key and no mapping library: OpenStreetMap serves raster
// tiles at a fixed URL scheme, so positioning a grid of <img> tiles and
// absolutely-placed markers over them is the whole implementation. That
// matters here because the alternative was a permanently empty panel waiting
// for a Google Maps key the business would have to buy.

const TILE_SIZE = 256;
const MAX_ZOOM = 17;
const MIN_ZOOM = 2;

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string | null;
  tone?: "primary" | "muted";
}

/** Web Mercator: longitude maps linearly, latitude through the Mercator projection. */
function project(lat: number, lng: number, zoom: number) {
  const scale = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function chooseZoom(points: MapPoint[], width: number, height: number) {
  if (points.length < 2) return 15;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const projected = points.map((p) => project(p.lat, p.lng, zoom));
    const spanX = (Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x))) * TILE_SIZE;
    const spanY = (Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y))) * TILE_SIZE;
    // Leave a margin so a marker sitting on the edge of the set isn't clipped.
    if (spanX < width - 80 && spanY < height - 80) return zoom;
  }
  return MIN_ZOOM;
}

export function TileMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActive(null);
  }, [points]);

  const ready = size.width > 0 && size.height > 0 && points.length > 0;

  let tiles: { key: string; src: string; left: number; top: number }[] = [];
  let markers: { point: MapPoint; left: number; top: number }[] = [];

  if (ready) {
    const zoom = chooseZoom(points, size.width, size.height);
    const projected = points.map((p) => project(p.lat, p.lng, zoom));
    const centerX = (Math.min(...projected.map((p) => p.x)) + Math.max(...projected.map((p) => p.x))) / 2;
    const centerY = (Math.min(...projected.map((p) => p.y)) + Math.max(...projected.map((p) => p.y))) / 2;

    // Pixel of the map's top-left corner, in absolute world pixels.
    const originPx = { x: centerX * TILE_SIZE - size.width / 2, y: centerY * TILE_SIZE - size.height / 2 };

    const firstTileX = Math.floor(originPx.x / TILE_SIZE);
    const firstTileY = Math.floor(originPx.y / TILE_SIZE);
    const columns = Math.ceil(size.width / TILE_SIZE) + 1;
    const rows = Math.ceil(size.height / TILE_SIZE) + 1;
    const worldTiles = Math.pow(2, zoom);

    for (let dx = 0; dx < columns; dx++) {
      for (let dy = 0; dy < rows; dy++) {
        const tileX = firstTileX + dx;
        const tileY = firstTileY + dy;
        if (tileY < 0 || tileY >= worldTiles) continue;
        // Longitude wraps, so a tile column off the edge is a real tile.
        const wrappedX = ((tileX % worldTiles) + worldTiles) % worldTiles;
        tiles.push({
          key: `${zoom}/${tileX}/${tileY}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - originPx.x,
          top: tileY * TILE_SIZE - originPx.y,
        });
      }
    }

    markers = points.map((point, i) => ({
      point,
      left: projected[i].x * TILE_SIZE - originPx.x,
      top: projected[i].y * TILE_SIZE - originPx.y,
    }));
  }

  return (
    <div ref={container} className={`relative overflow-hidden bg-secondary ${className ?? ""}`}>
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          loading="lazy"
          className="absolute select-none pointer-events-none max-w-none"
          style={{ left: tile.left, top: tile.top }}
          // A tile that fails (offline, blocked, rate-limited) should leave
          // plain background, not a row of broken-image icons.
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ))}

      {markers.map(({ point, left, top }) => (
        <button
          key={point.id}
          className="absolute -translate-x-1/2 -translate-y-full focus:outline-none"
          style={{ left, top }}
          onClick={() => setActive((current) => (current === point.id ? null : point.id))}
        >
          <span
            className={`block w-3.5 h-3.5 rounded-full border-2 border-card shadow-md ${
              point.tone === "muted" ? "bg-muted-foreground" : "bg-primary"
            }`}
          />
          {active === point.id && (
            <span className="absolute left-1/2 -translate-x-1/2 bottom-5 whitespace-nowrap rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground shadow-md">
              <span className="font-medium">{point.label}</span>
              {point.sublabel && <span className="block text-muted-foreground">{point.sublabel}</span>}
            </span>
          )}
        </button>
      ))}

      {/* OpenStreetMap's tile usage policy requires visible attribution. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 bg-card/85 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-tl-md hover:text-foreground"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
