export type VendorStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** Mirrors the Vendor model in apps/user-service/prisma/schema.prisma. */
export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  legalName: string | null;
  vendorCode: string;
  description: string | null;
  logoUrl: string | null;
  gstin: string | null;
  pan: string | null;
  fssaiLicense: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  status: VendorStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  commissionBps: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorWithUser extends Vendor {
  user?: { mobile: string; email: string | null; displayName: string | null };
  documents?: VendorDocument[];
}

export interface VendorDocument {
  id: string;
  type: string;
  storageKey: string;
  verified: boolean;
  notes: string | null;
  createdAt: string;
}

export interface VendorListQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: VendorStatus;
}

export interface ReviewVendorInput {
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  reason?: string;
  commissionBps?: number;
}
