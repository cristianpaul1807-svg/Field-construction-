import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Crosshair } from "lucide-react";

// A map with no API key and no mapping library: OpenStreetMap serves raster
// tiles at a fixed URL scheme, so positioning a grid of <img> tiles and
// absolutely-placed markers over them is the whole implementation. That
// matters here because the alternative was a permanently empty panel waiting
// for a Google Maps key the business would have to buy.
//
// It pans and zooms because a map you cannot move is a picture. On a site with
// three crews in the same street, the auto-fit view puts all three markers on
// top of each other and the only way to tell them apart is to zoom in.

const TILE_SIZE = 256;
const MAX_ZOOM = 19;
const MIN_ZOOM = 2;

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string | null;
  tone?: "primary" | "muted" | "warning";
  /** Shown on the marker itself. A hard hat for a worker on site. */
  emoji?: string;
}

interface View {
  centerLat: number;
  centerLng: number;
  zoom: number;
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

/** The inverse, so a drag in pixels can become a new centre in degrees. */
function unproject(x: number, y: number, zoom: number) {
  const scale = Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function fitView(points: MapPoint[], width: number, height: number): View {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  if (points.length < 2) return { centerLat, centerLng, zoom: 16 };

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const projected = points.map((p) => project(p.lat, p.lng, zoom));
    const spanX = (Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x))) * TILE_SIZE;
    const spanY = (Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y))) * TILE_SIZE;
    // Leave a margin so a marker sitting on the edge of the set isn't clipped.
    if (spanX < width - 120 && spanY < height - 120) return { centerLat, centerLng, zoom };
  }
  return { centerLat, centerLng, zoom: MIN_ZOOM };
}

export function TileMap({
  points,
  className,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  className?: string;
  /** Highlighted marker. Drives the card the page shows beside the map. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  // Two fingers on a phone: the distance between them drives the zoom.
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const recenter = useCallback(() => {
    if (size.width > 0 && points.length > 0) setView(fitView(points, size.width, size.height));
  }, [points, size.width, size.height]);

  // Fit once when the data or the box first arrives. Not on every render: a
  // poll that refreshes the positions must not yank the map back from wherever
  // the user just panned to.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || size.width === 0 || points.length === 0) return;
    fitted.current = true;
    setView(fitView(points, size.width, size.height));
  }, [points, size.width, size.height]);

  const ready = size.width > 0 && size.height > 0 && view !== null;

  const zoomBy = (delta: number) => {
    setView((current) =>
      current ? { ...current, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom + delta)) } : current
    );
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pinch.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = Array.from(pinch.current.values());
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view?.zoom ?? 16 };
      drag.current = null;
      return;
    }
    container.current?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pinch.current.has(event.pointerId)) {
      pinch.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinch.current.size === 2 && pinchStart.current && view) {
      const [a, b] = Array.from(pinch.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      // Doubling the finger distance is one zoom level, which is how every
      // other map behaves and therefore what a thumb expects.
      const next = pinchStart.current.zoom + Math.log2(distance / pinchStart.current.distance);
      setView({ ...view, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)) });
      return;
    }

    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || !view) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.moved = true;
    state.x = event.clientX;
    state.y = event.clientY;

    const center = project(view.centerLat, view.centerLng, view.zoom);
    const moved = unproject(center.x - dx / TILE_SIZE, center.y - dy / TILE_SIZE, view.zoom);
    setView({ ...view, centerLat: moved.lat, centerLng: moved.lng });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pinch.current.delete(event.pointerId);
    if (pinch.current.size < 2) pinchStart.current = null;
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  let tiles: { key: string; src: string; left: number; top: number }[] = [];
  let markers: { point: MapPoint; left: number; top: number }[] = [];

  if (ready && view) {
    const zoom = Math.round(view.zoom);
    const center = project(view.centerLat, view.centerLng, zoom);
    // Pixel of the map's top-left corner, in absolute world pixels.
    const originPx = { x: center.x * TILE_SIZE - size.width / 2, y: center.y * TILE_SIZE - size.height / 2 };

    const firstTileX = Math.floor(originPx.x / TILE_SIZE);
    const firstTileY = Math.floor(originPx.y / TILE_SIZE);
    const columns = Math.ceil(size.width / TILE_SIZE) + 2;
    const rows = Math.ceil(size.height / TILE_SIZE) + 2;
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

    markers = points.map((point) => {
      const p = project(point.lat, point.lng, zoom);
      return { point, left: p.x * TILE_SIZE - originPx.x, top: p.y * TILE_SIZE - originPx.y };
    });
  }

  return (
    <div
      ref={container}
      className={`relative overflow-hidden bg-secondary touch-none select-none ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event) => zoomBy(event.deltaY > 0 ? -0.5 : 0.5)}
      style={{ cursor: drag.current ? "grabbing" : "grab" }}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          loading="lazy"
          draggable={false}
          className="absolute select-none pointer-events-none max-w-none"
          style={{ left: tile.left, top: tile.top }}
          // A tile that fails (offline, blocked, rate-limited) should leave
          // plain background, not a row of broken-image icons.
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ))}

      {markers.map(({ point, left, top }) => {
        const selected = selectedId === point.id;
        return (
          <button
            key={point.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-full focus:outline-none"
            style={{ left, top, zIndex: selected ? 20 : 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              // A click that ended a drag is not a click on the marker.
              if (drag.current?.moved) return;
              onSelect?.(point.id);
            }}
          >
            {/* The name rides above the marker so a supervisor can read the
                map without tapping every pin to find out who is who. */}
            <span
              className={`block mb-0.5 max-w-[8.5rem] truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium shadow-sm ${
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : point.tone === "muted"
                    ? "bg-card/90 text-muted-foreground border-border"
                    : "bg-card text-foreground border-border"
              }`}
            >
              {point.label}
            </span>
            <span
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm shadow-md ${
                point.tone === "muted"
                  ? "bg-secondary border-card opacity-70"
                  : point.tone === "warning"
                    ? "bg-status-warning-bg border-status-warning-fg"
                    : "bg-card border-primary"
              }`}
            >
              {point.emoji ?? "📍"}
            </span>
          </button>
        );
      })}

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {[
          { icon: <Plus size={15} />, action: () => zoomBy(1), label: "+" },
          { icon: <Minus size={15} />, action: () => zoomBy(-1), label: "−" },
          { icon: <Crosshair size={15} />, action: recenter, label: "⌖" },
        ].map((control) => (
          <button
            key={control.label}
            type="button"
            aria-label={control.label}
            className="h-8 w-8 rounded-md bg-card/95 border border-border text-foreground shadow-sm flex items-center justify-center hover:bg-secondary"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={control.action}
          >
            {control.icon}
          </button>
        ))}
      </div>

      {/* OpenStreetMap's tile usage policy requires visible attribution. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 bg-card/85 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-tl-md hover:text-foreground"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
