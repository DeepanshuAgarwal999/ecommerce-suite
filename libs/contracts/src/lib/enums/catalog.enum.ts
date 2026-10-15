// See the note in role.enum.ts for why these are const objects rather than `enum`.

export const ProductStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const VendorStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];

export const StockMovementType = {
  INBOUND: 'INBOUND',
  RESERVE: 'RESERVE',
  RELEASE: 'RELEASE',
  COMMIT: 'COMMIT',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
  DAMAGE: 'DAMAGE',
} as const;

export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const ReservationStatus = {
  HELD: 'HELD',
  COMMITTED: 'COMMITTED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const AddressType = {
  HOME: 'HOME',
  WORK: 'WORK',
  OTHER: 'OTHER',
} as const;

export type AddressType = (typeof AddressType)[keyof typeof AddressType];

export const WarehouseType = {
  FULFILMENT_CENTRE: 'FULFILMENT_CENTRE',
  DARK_STORE: 'DARK_STORE',
  VENDOR_MANAGED: 'VENDOR_MANAGED',
} as const;

export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  UNDISCLOSED: 'UNDISCLOSED',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];
