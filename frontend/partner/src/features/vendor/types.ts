/** Mirrors VendorStatus in libs/contracts/enums/catalog.enum.ts. */
export type VendorStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** The vendor record returned by /vendor/me. */
export interface Vendor {
  id: string;
  businessName: string;
  legalName: string | null;
  description: string | null;
  gstin: string | null;
  pan: string | null;
  fssaiLicense: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  vendorCode: string;
  status: VendorStatus;
  /** Set only when status is REJECTED or SUSPENDED. */
  rejectionReason?: string | null;
  commissionBps?: number;
  createdAt: string;
}

/** Mirrors ApplyVendorDto in libs/contracts/dto/user.dto.ts. */
export interface ApplyVendorInput {
  businessName: string;
  legalName?: string;
  description?: string;
  gstin?: string;
  pan?: string;
  fssaiLicense?: string;
  supportEmail?: string;
  supportPhone?: string;
}
