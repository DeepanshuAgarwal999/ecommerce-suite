import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useLocationStore, type DeliveryLocation } from './store';

type DetectState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

/**
 * "Use my current location": permission -> a balanced-accuracy fix -> the OS
 * reverse geocoder for pincode and locality. On-device geocoding works signed
 * out (the gateway's /geo routes are signed-in only) and costs no API quota.
 */
export function useDetectLocation() {
  const [state, setState] = useState<DetectState>({ kind: 'idle' });
  const setLocation = useLocationStore((store) => store.setLocation);

  const detect = useCallback(async (): Promise<DeliveryLocation | null> => {
    setState({ kind: 'locating' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setState({ kind: 'denied' });
        return null;
      }

      // A recent cached fix is instant and accurate enough for a delivery pincode.
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      const [place] = await Location.reverseGeocodeAsync(position.coords);
      if (!place?.postalCode) {
        setState({ kind: 'error', message: "We couldn't find a pincode here. Enter it instead." });
        return null;
      }

      const location: DeliveryLocation = {
        pincode: place.postalCode,
        label: [place.district ?? place.subregion ?? place.street, place.city].filter(Boolean).join(', '),
        city: place.city ?? undefined,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocation(location);
      setState({ kind: 'idle' });
      return location;
    } catch {
      setState({ kind: 'error', message: 'Location is unavailable. Check that GPS is on.' });
      return null;
    }
  }, [setLocation]);

  return { state, detect };
}
