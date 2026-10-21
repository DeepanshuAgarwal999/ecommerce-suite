'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, MapPin, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { isApiError } from '@/lib/api';
import { addressApi } from '../api/address-api';
import type { ReverseGeocode } from '../types';
import type { LatLng } from './address-map';

const AddressMap = dynamic(() => import('./address-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/** Geographic centre of India - where "Pick on map" opens without a location. */
const INDIA: LatLng = { lat: 22.5, lng: 79 };

type Status = 'idle' | 'locating' | 'resolving' | 'ready' | 'error';

interface LocationPickerProps {
  /** An existing pin (editing a saved address) - opens the map straight on it. */
  initial?: LatLng | null;
  /** The shopper confirmed the pin: fill the form from it. */
  onConfirm: (place: ReverseGeocode) => void;
}

/**
 * "Use my current location" + a draggable map, the way Flipkart/Meesho/Swiggy do it:
 * GPS gives a first guess, the shopper fine-tunes the pin to their exact gate, and
 * we turn that point into address fields (via our backend geocoder) for them to
 * complete with flat/house details. Everything is optional - the manual form below
 * always works, including when location permission is denied.
 */
export function LocationPicker({ initial, onConfirm }: LocationPickerProps) {
  const [open, setOpen] = useState(Boolean(initial));
  const [center, setCenter] = useState<LatLng>(initial ?? INDIA);
  const [zoom, setZoom] = useState(initial ? 17 : 5);
  const [status, setStatus] = useState<Status>('idle');
  const [place, setPlace] = useState<ReverseGeocode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resolve = useCallback(async (point: LatLng) => {
    const id = ++request.current;
    setStatus('resolving');
    setError(null);
    try {
      const result = await addressApi.reverseGeocode(point.lat, point.lng);
      if (id !== request.current) return; // a newer pin position won
      setPlace(result);
      setStatus('ready');
    } catch (err) {
      if (id !== request.current) return;
      setPlace(null);
      setStatus('error');
      setError(
        isApiError(err) && err.isNotFound
          ? 'We couldn’t find an address here. Move the pin a little, or fill the form manually.'
          : 'Location lookup is unavailable right now - please fill the address manually.',
      );
    }
  }, []);

  /** Map stopped moving: look the point up once the shopper pauses. */
  const onSettle = useCallback(
    (point: LatLng, mapZoom: number) => {
      // Still at country/state level: a lookup would just say "India".
      if (mapZoom < 13) return;
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void resolve(point), 500);
    },
    [resolve],
  );

  useEffect(() => () => clearTimeout(debounce.current), []);

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setError('Your browser can’t share location. Pick the spot on the map or fill the form manually.');
      setOpen(true);
      return;
    }
    setOpen(true);
    setStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCenter(point);
        setZoom(17);
        void resolve(point);
      },
      (geoError) => {
        setStatus('error');
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission is blocked. Allow it in your browser settings, or move the map to your address.'
            : 'Couldn’t get your location. Move the map to your address, or fill the form manually.',
        );
        setZoom((current) => Math.max(current, 5));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-11 justify-start gap-2.5" onClick={useMyLocation}>
          {status === 'locating' ? <Spinner className="size-4" /> : <LocateFixed className="text-primary size-4" />}
          Use my current location
        </Button>
        {!open && (
          <Button type="button" variant="outline" className="h-11 justify-start gap-2.5" onClick={() => setOpen(true)}>
            <MapPinned className="text-primary size-4" />
            Pick on map
          </Button>
        )}
      </div>

      {open && (
        <div className="overflow-hidden rounded-xl border">
          <div className="relative h-[260px] md:h-[300px]">
            <AddressMap center={center} zoom={zoom} onSettle={onSettle} />
            <p className="bg-foreground/80 text-background pointer-events-none absolute top-2 left-1/2 z-[1000] -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap">
              <Crosshair className="mr-1 inline size-3" aria-hidden />
              Move the map to place the pin on your door
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t p-3" aria-live="polite">
            {status === 'resolving' || status === 'locating' ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Spinner className="size-4" /> Finding the address at this pin…
              </p>
            ) : place ? (
              <>
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="line-clamp-2">{place.displayName}</span>
                </p>
                <Button type="button" size="sm" className="self-start" onClick={() => onConfirm(place)}>
                  Use this location
                </Button>
              </>
            ) : error ? (
              <p className="text-destructive text-sm">{error}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Zoom in and move the map to your address.</p>
            )}
            {place && error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
