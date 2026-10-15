import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  CacheTtl,
  KafkaTopics,
  RequestContext,
  Role,
  VendorStatus,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/user';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyVendorDto, ReviewVendorDto } from '@ecommerce/contracts';

/**
 * Vendor onboarding.
 *
 * A vendor is a user with an approved application, not a separate account type. Approval
 * grants the VENDOR role, which is what actually unlocks the seller APIs - the role
 * change is published as an event and applied by auth-service, so authorisation stays
 * owned by exactly one service.
 */
@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async apply(userId: string, dto: ApplyVendorDto, ctx: RequestContext) {
    const existing = await this.prisma.vendor.findUnique({ where: { userId } });

    if (existing) {
      // A rejected applicant may reapply; an approved or in-flight one may not.
      if (existing.status !== VendorStatus.REJECTED) {
        throw AppException.conflict(
          `You already have a vendor application with status ${existing.status}`,
        );
      }
      return this.prisma.vendor.update({
        where: { id: existing.id },
        data: {
          businessName: dto.businessName,
          legalName: dto.legalName,
          description: dto.description,
          gstin: dto.gstin,
          pan: dto.pan,
          fssaiLicense: dto.fssaiLicense,
          supportEmail: dto.supportEmail,
          supportPhone: dto.supportPhone,
          pickupAddress: dto.pickupAddress as never,
          status: VendorStatus.PENDING,
          rejectionReason: null,
        },
      });
    }

    const profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile) throw AppException.notFound('Profile', userId);

    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          userId,
          businessName: dto.businessName,
          legalName: dto.legalName,
          vendorCode: await this.generateVendorCode(dto.businessName),
          description: dto.description,
          gstin: dto.gstin,
          pan: dto.pan,
          fssaiLicense: dto.fssaiLicense,
          supportEmail: dto.supportEmail,
          supportPhone: dto.supportPhone,
          pickupAddress: dto.pickupAddress as never,
          status: VendorStatus.PENDING,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.VENDOR_APPLIED,
          partitionKey: vendor.id,
          correlationId: ctx.correlationId,
          actorId: userId,
          payload: {
            vendorId: vendor.id,
            userId,
            businessName: vendor.businessName,
            status: vendor.status,
          },
        }),
      });

      return vendor;
    });
  }

  /**
   * Admin decision on an application.
   *
   * Approval emits two facts: the vendor status change (which catalog-service uses to
   * allow listings) and, implicitly through the same event, the role grant that
   * auth-service applies. Publishing rather than calling keeps this transaction local
   * and makes the whole flow retryable.
   */
  async review(vendorId: string, dto: ReviewVendorDto, ctx: RequestContext) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw AppException.notFound('Vendor', vendorId);

    if (vendor.status === dto.status) {
      throw AppException.conflict(`Vendor is already ${dto.status}`);
    }

    const topic =
      dto.status === VendorStatus.APPROVED
        ? KafkaTopics.VENDOR_APPROVED
        : dto.status === VendorStatus.SUSPENDED
          ? KafkaTopics.VENDOR_SUSPENDED
          : KafkaTopics.VENDOR_REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: dto.status,
          rejectionReason: dto.status === VendorStatus.REJECTED ? dto.reason : null,
          commissionBps: dto.commissionBps ?? vendor.commissionBps,
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic,
          partitionKey: vendorId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            vendorId,
            userId: next.userId,
            businessName: next.businessName,
            status: next.status,
            reason: dto.reason,
            reviewedBy: ctx.userId,
            // Consumed by auth-service to grant or revoke the seller role.
            grantRole: dto.status === VendorStatus.APPROVED ? Role.VENDOR : null,
            revokeRole: dto.status === VendorStatus.APPROVED ? null : Role.VENDOR,
          },
        }),
      });

      return next;
    });

    this.logger.log(`vendor ${vendorId} -> ${dto.status} by ${ctx.userId ?? 'system'}`);
    return updated;
  }

  async getByUser(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: { documents: true },
    });
    if (!vendor) throw AppException.notFound('Vendor application for user', userId);
    return vendor;
  }

  async getById(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { mobile: true, email: true, displayName: true } } },
    });
    if (!vendor) throw AppException.notFound('Vendor', vendorId);
    return vendor;
  }

  async list(query: { page?: number; limit?: number; status?: VendorStatus; q?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.VendorWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { businessName: { contains: query.q, mode: 'insensitive' } },
              { vendorCode: { contains: query.q, mode: 'insensitive' } },
              { gstin: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Vendor counts grouped by status, for the admin dashboard's status chart -
   * one query instead of one `limit=1` filtered list call per status.
   * Cached briefly and stampede-protected the same way order summary/trend
   * are; see the note there for why.
   */
  async summary(): Promise<{ status: VendorStatus; count: number }[]> {
    return this.cache.wrap(
      CacheKeys.adminSummary('vendors'),
      async () => {
        const rows = await this.prisma.vendor.groupBy({
          by: ['status'],
          _count: { _all: true },
        });
        return rows.map((row) => ({ status: row.status, count: row._count._all }));
      },
      { ttlSeconds: CacheTtl.ADMIN_SUMMARY },
    );
  }

  /**
   * Builds a short, unique vendor code from the business name.
   *
   * It becomes the SKU prefix for everything the vendor sells, so it has to be stable
   * and collision-free. Retries with fresh entropy rather than assuming the first
   * candidate is free.
   */
  private async generateVendorCode(businessName: string): Promise<string> {
    const base = businessName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
      .padEnd(3, 'X');

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `${base}${randomBytes(2).toString('hex').toUpperCase()}`.slice(0, 12);
      const taken = await this.prisma.vendor.findUnique({
        where: { vendorCode: code },
        select: { id: true },
      });
      if (!taken) return code;
    }

    throw AppException.conflict('Could not allocate a vendor code, please retry');
  }
}
