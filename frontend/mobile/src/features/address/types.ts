/** Mirrors the user-service Address model. */
export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

export interface Address {
  id: string;
  label: AddressLabel;
  /** Custom name for OTHER - "Mom's place". */
  labelName: string | null;
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  /** House / flat / building. */
  line1: string;
  /** Area / street / locality. */
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  label: AddressLabel;
  labelName?: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

/** GET /geo/reverse - a map pin already split into form fields. */
export interface ReverseGeocode {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

/** GET /geo/pincode/:pincode */
export interface PincodeInfo {
  pincode: string;
  city: string;
  state: string;
  areas: string[];
}

export const LABELS: { value: AddressLabel; label: string }[] = [
  { value: 'HOME', label: 'Home' },
  { value: 'WORK', label: 'Work / Office' },
  { value: 'OTHER', label: 'Other' },
];

/** How a saved address is named in lists: "Home", "Work", or the custom name. */
export function addressTitle(address: Pick<Address, 'label' | 'labelName'>): string {
  if (address.label === 'OTHER') return address.labelName || 'Other';
  return address.label === 'HOME' ? 'Home' : 'Work';
}

/** One-line address for cards and the checkout summary. */
export function formatAddress(address: Pick<Address, 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pincode'>): string {
  return [address.line1, address.line2, address.landmark && `Near ${address.landmark}`, address.city, `${address.state} - ${address.pincode}`]
    .filter(Boolean)
    .join(', ');
}
