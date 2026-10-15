import { Injectable } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import { CacheKeys, Limits } from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from '@ecommerce/contracts';

/**
 * Delivery addresses.
 *
 * Deletes are soft. A past order references the address that was current when it was
 * placed, and support needs to be able to see it; hard-deleting would leave orders
 * pointing at nothing. The order itself also stores a frozen copy, so this is belt and
 * braces - but the copy is what makes the soft delete safe to reason about.
 */
@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, isDeleted: false },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId, isDeleted: false },
    });
    if (!address) throw AppException.notFound('Address', addressId);
    return address;
  }

  async create(userId: string, dto: CreateAddressDto) {
    const count = await this.prisma.address.count({ where: { userId, isDeleted: false } });
    if (count >= Limits.MAX_ADDRESSES_PER_USER) {
      throw AppException.conflict(
        `You can save at most ${Limits.MAX_ADDRESSES_PER_USER} addresses. Delete one first.`,
      );
    }

    // The first address a user saves is their default, whatever the flag says.
    const makeDefault = dto.isDefault || count === 0;

    const address = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          label: dto.label,
          fullName: dto.fullName,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          line1: dto.line1,
          line2: dto.line2,
          landmark: dto.landmark,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country ?? 'India',
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: makeDefault,
        },
      });
    });

    await this.cache.invalidate(CacheKeys.userProfile(userId));
    return address;
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.get(userId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, NOT: { id: addressId } },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          label: dto.label,
          fullName: dto.fullName,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          line1: dto.line1,
          line2: dto.line2,
          landmark: dto.landmark,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          country: dto.country,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: dto.isDefault,
        },
      });
    });

    await this.cache.invalidate(CacheKeys.userProfile(userId));
    return address;
  }

  async remove(userId: string, addressId: string) {
    const address = await this.get(userId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: addressId },
        data: { isDeleted: true, isDefault: false },
      });

      // Never leave the account without a default - the checkout screen depends on one.
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId, isDeleted: false },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });

    await this.cache.invalidate(CacheKeys.userProfile(userId));
    return { ok: true as const };
  }

  async setDefault(userId: string, addressId: string) {
    await this.get(userId, addressId);

    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);

    await this.cache.invalidate(CacheKeys.userProfile(userId));
    return { ok: true as const };
  }
}
