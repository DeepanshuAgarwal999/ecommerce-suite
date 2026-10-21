import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '@ecommerce/common';
import { CacheService } from '@ecommerce/redis';

/** What the address form needs from a map pin - already split into its fields. */
export interface ReverseGeocodeResult {
  /** Building / house + road, when the map knows it. Usually still needs a flat no. */
  line1: string;
  /** Locality: neighbourhood, suburb, area. */
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  /** Full one-line description, shown under the map. */
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface PincodeResult {
  pincode: string;
  city: string;
  state: string;
  /** Post-office areas under this pincode - offered as locality suggestions. */
  areas: string[];
}

interface NominatimResponse {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
  error?: string;
}

interface IndiaPostResponse {
  Status: string;
  PostOffice:
    | { Name: string; District: string; State: string; Pincode: string; DeliveryStatus: string; BranchType: string }[]
    | null;
}

const REVERSE_TTL = 24 * 60 * 60;
const PINCODE_TTL = 30 * 24 * 60 * 60;
const NOT_FOUND = '__none__';

/**
 * Geocoding for the address form: "use my location" / dragging the map pin
 * (reverse geocoding) and pincode -> city/state autofill.
 *
 * Providers are free, keyless defaults - OpenStreetMap Nominatim for reverse
 * geocoding, India Post's directory for pincodes - called from here (never the
 * browser) so the provider can be swapped for Google Maps / MapmyIndia by changing
 * this one class, keys stay server-side, and results are cached:
 *  - reverse lookups by coordinates rounded to ~11 m (4 decimals): a shopper nudging
 *    the pin around one building hits the cache;
 *  - pincodes for 30 days (they essentially never change).
 * Nominatim's usage policy asks for <= 1 request/second and an identifying
 * User-Agent; both are enforced here. At real scale, move to a paid provider or a
 * self-hosted Nominatim.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly userAgent: string;
  private nextNominatimSlot = 0;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.userAgent =
      config.get<string>('GEOCODER_USER_AGENT') ?? process.env.GEOCODER_USER_AGENT ?? 'nestora-storefront/1.0';
  }

  async reverse(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw AppException.validation('Invalid coordinates');
    }
    const lat = Number(latitude.toFixed(4));
    const lng = Number(longitude.toFixed(4));

    const result = await this.cache.wrap(
      `geo:rev:${lat}:${lng}`,
      async () => {
        await this.politeDelay();
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
        const body = await this.fetchJson<NominatimResponse>(url, { 'Accept-Language': 'en-IN,en' });
        if (!body?.address || body.error) return null;
        return this.toAddress(body, latitude, longitude);
      },
      { ttlSeconds: REVERSE_TTL },
    );
    if (!result) throw AppException.notFound('Address at location', `${lat},${lng}`);
    // Echo the shopper's exact point, not the rounded cache key.
    return { ...result, latitude, longitude };
  }

  async pincode(pincode: string): Promise<PincodeResult> {
    if (!/^[1-9]\d{5}$/.test(pincode)) throw AppException.validation('Pincode must be 6 digits');

    const cached = await this.cache.wrap(
      `geo:pin:${pincode}`,
      async () => {
        const body = await this.fetchJson<IndiaPostResponse[]>(`https://api.postalpincode.in/pincode/${pincode}`);
        const offices = body?.[0]?.Status === 'Success' ? (body[0].PostOffice ?? []) : [];
        if (offices.length === 0) return NOT_FOUND;
        const delivery = offices.filter((office) => office.DeliveryStatus === 'Delivery');
        const pool = delivery.length ? delivery : offices;
        // A pincode spans several post offices, sometimes in different districts
        // (400001 lists Elephanta Caves, Raigad, before Mumbai GPO). Trust the most
        // senior office - Head > Sub > Branch - then the most common district.
        // "Branch Office directly a/w Head Office" mentions Head too - test Branch first.
        const rank = (type: string) => (/branch/i.test(type) ? 2 : /head/i.test(type) ? 0 : /sub/i.test(type) ? 1 : 2);
        const best = Math.min(...pool.map((office) => rank(office.BranchType)));
        const senior = pool.filter((office) => rank(office.BranchType) === best);
        const votes = new Map<string, number>();
        senior.forEach((office) => votes.set(office.District, (votes.get(office.District) ?? 0) + 1));
        const district = [...votes].sort((a, b) => b[1] - a[1])[0][0];
        const primary = senior.find((office) => office.District === district)!;
        return {
          pincode,
          // "Raigarh(MH)" -> "Raigarh"
          city: district.replace(/\s*\(.*\)\s*$/, '').trim(),
          state: primary.State.trim(),
          areas: [...new Set(pool.map((office) => office.Name.trim()))].slice(0, 20),
        } satisfies PincodeResult;
      },
      { ttlSeconds: PINCODE_TTL },
    );
    if (cached === NOT_FOUND) throw AppException.notFound('Pincode', pincode);
    return cached as PincodeResult;
  }

  private toAddress(body: NominatimResponse, latitude: number, longitude: number): ReverseGeocodeResult {
    const a = body.address ?? {};
    const pick = (...keys: string[]) => keys.map((key) => a[key]).find((value) => value && value.trim()) ?? '';
    const building = pick('building', 'amenity', 'shop', 'office', 'house_name') || (body.name ?? '');
    const street = [pick('house_number'), pick('road', 'pedestrian', 'street')].filter(Boolean).join(' ');
    return {
      line1: [building, street].filter(Boolean).join(', '),
      line2: [pick('neighbourhood', 'quarter', 'residential'), pick('suburb', 'city_district', 'village', 'hamlet')]
        .filter((value, index, all) => value && all.indexOf(value) === index)
        .join(', '),
      city: pick('city', 'town', 'municipality', 'county', 'state_district', 'village'),
      state: pick('state', 'region'),
      pincode: (pick('postcode').match(/\d{6}/) ?? [''])[0],
      country: pick('country') || 'India',
      displayName: body.display_name ?? '',
      latitude,
      longitude,
    };
  }

  /** Nominatim: at most one request per second from this process. */
  private async politeDelay(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextNominatimSlot);
    this.nextNominatimSlot = slot + 1000;
    if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
  }

  private async fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) {
        this.logger.warn(`geocoder ${response.status} for ${url}`);
        throw AppException.unavailable('Location lookup is unavailable right now');
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.warn(`geocoder failed for ${url}: ${(error as Error).message}`);
      throw AppException.unavailable('Location lookup is unavailable right now');
    }
  }
}
