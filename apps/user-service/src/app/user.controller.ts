import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RequestContext, UserPatterns, VendorStatus } from '@ecommerce/contracts';
import { AddressService } from './address/address.service';
import { GeoService } from './address/geo.service';
import { ProfileService } from './profile/profile.service';
import {
  ApplyVendorDto,
  CreateAddressDto,
  ReviewVendorDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from '@ecommerce/contracts';
import { VendorService } from './vendor/vendor.service';

@Controller()
export class UserController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly addresses: AddressService,
    private readonly vendors: VendorService,
    private readonly geo: GeoService,
  ) {}

  // --- profile -------------------------------------------------------------

  @MessagePattern(UserPatterns.GET_PROFILE)
  getProfile(@Payload() msg: { userId: string }) {
    return this.profiles.getProfile(msg.userId);
  }

  @MessagePattern(UserPatterns.UPDATE_PROFILE)
  updateProfile(@Payload() msg: { userId: string; dto: UpdateProfileDto; ctx: RequestContext }) {
    return this.profiles.updateProfile(msg.userId, msg.dto, msg.ctx);
  }

  @MessagePattern(UserPatterns.ADMIN_LIST_USERS)
  listUsers(@Payload() msg: { page?: number; limit?: number; q?: string }) {
    return this.profiles.listUsers(msg);
  }

  // --- addresses -----------------------------------------------------------

  @MessagePattern(UserPatterns.LIST_ADDRESSES)
  listAddresses(@Payload() msg: { userId: string }) {
    return this.addresses.list(msg.userId);
  }

  @MessagePattern(UserPatterns.GET_ADDRESS)
  getAddress(@Payload() msg: { userId: string; addressId: string }) {
    return this.addresses.get(msg.userId, msg.addressId);
  }

  @MessagePattern(UserPatterns.CREATE_ADDRESS)
  createAddress(@Payload() msg: { userId: string; dto: CreateAddressDto }) {
    return this.addresses.create(msg.userId, msg.dto);
  }

  @MessagePattern(UserPatterns.UPDATE_ADDRESS)
  updateAddress(@Payload() msg: { userId: string; addressId: string; dto: UpdateAddressDto }) {
    return this.addresses.update(msg.userId, msg.addressId, msg.dto);
  }

  @MessagePattern(UserPatterns.DELETE_ADDRESS)
  deleteAddress(@Payload() msg: { userId: string; addressId: string }) {
    return this.addresses.remove(msg.userId, msg.addressId);
  }

  @MessagePattern(UserPatterns.SET_DEFAULT_ADDRESS)
  setDefaultAddress(@Payload() msg: { userId: string; addressId: string }) {
    return this.addresses.setDefault(msg.userId, msg.addressId);
  }

  @MessagePattern(UserPatterns.GEO_REVERSE)
  reverseGeocode(@Payload() msg: { latitude: number; longitude: number }) {
    return this.geo.reverse(Number(msg.latitude), Number(msg.longitude));
  }

  @MessagePattern(UserPatterns.GEO_PINCODE)
  lookupPincode(@Payload() msg: { pincode: string }) {
    return this.geo.pincode(String(msg.pincode));
  }

  // --- vendors -------------------------------------------------------------

  @MessagePattern(UserPatterns.APPLY_VENDOR)
  applyVendor(@Payload() msg: { userId: string; dto: ApplyVendorDto; ctx: RequestContext }) {
    return this.vendors.apply(msg.userId, msg.dto, msg.ctx);
  }

  @MessagePattern(UserPatterns.GET_VENDORS_BY_CODES)
  getVendorsByCodes(@Payload() msg: { codes: string[] }) {
    return this.vendors.getByCodes(msg.codes ?? []);
  }

  @MessagePattern(UserPatterns.GET_VENDOR)
  getVendor(@Payload() msg: { vendorId?: string; userId?: string }) {
    return msg.vendorId
      ? this.vendors.getById(msg.vendorId)
      : this.vendors.getByUser(msg.userId as string);
  }

  @MessagePattern(UserPatterns.LIST_VENDORS)
  listVendors(
    @Payload() msg: { page?: number; limit?: number; status?: VendorStatus; q?: string },
  ) {
    return this.vendors.list(msg);
  }

  @MessagePattern(UserPatterns.ADMIN_VENDORS_SUMMARY)
  vendorsSummary() {
    return this.vendors.summary();
  }

  @MessagePattern(UserPatterns.REVIEW_VENDOR)
  reviewVendor(@Payload() msg: { vendorId: string; dto: ReviewVendorDto; ctx: RequestContext }) {
    return this.vendors.review(msg.vendorId, msg.dto, msg.ctx);
  }
}
