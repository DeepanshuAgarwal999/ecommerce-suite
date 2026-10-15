import { Injectable, Logger } from '@nestjs/common';
import { AppException, applyBps } from '@ecommerce/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CouponContext {
  userId: string;
  itemTotal: number;
  vendorIds: string[];
  categoryIds?: string[];
  isFirstOrder?: boolean;
}

export interface CouponResult {
  code: string;
  amount: number;
  freeShipping: boolean;
}

/**
 * Coupon validation and redemption.
 *
 * Validation runs twice - once when the customer applies the code, and again at order
 * creation. The first is for feedback, the second is authoritative: a coupon can run out
 * of budget or expire in the minutes between the two, and only the check that happens
 * inside the order transaction can be trusted.
 */
@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, ctx: CouponContext): Promise<CouponResult> {
    const normalised = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code: normalised } });

    if (!coupon || !coupon.isActive) {
      throw AppException.validation('This coupon code is not valid');
    }

    const now = new Date();
    if (coupon.startsAt > now) throw AppException.validation('This coupon is not active yet');
    if (coupon.endsAt < now) throw AppException.validation('This coupon has expired');

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw AppException.validation('This coupon has been fully redeemed');
    }

    if (ctx.itemTotal < coupon.minOrderValue) {
      const shortfall = ((coupon.minOrderValue - ctx.itemTotal) / 100).toFixed(2);
      throw AppException.validation(`Add items worth ₹${shortfall} more to use this coupon`);
    }

    if (coupon.firstOrderOnly && ctx.isFirstOrder === false) {
      throw AppException.validation('This coupon is only valid on your first order');
    }

    if (
      coupon.applicableVendorIds.length > 0 &&
      !ctx.vendorIds.some((vendorId) => coupon.applicableVendorIds.includes(vendorId))
    ) {
      throw AppException.validation('This coupon does not apply to the items in your cart');
    }

    const used = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: ctx.userId },
    });
    if (used >= coupon.perUserLimit) {
      throw AppException.validation('You have already used this coupon');
    }

    return {
      code: coupon.code,
      amount: this.discountFor(coupon, ctx.itemTotal),
      freeShipping: coupon.type === 'FREE_SHIPPING',
    };
  }

  /**
   * Records a redemption against an order.
   *
   * The unique index on `(couponId, orderId)` is what makes this idempotent, and the
   * conditional increment on `usageCount` is what stops concurrent checkouts from
   * pushing a limited coupon past its budget.
   */
  async redeem(code: string, userId: string, orderId: string, discount: number): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) return;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          ...(coupon.usageLimit !== null ? { usageCount: { lt: coupon.usageLimit } } : {}),
        },
        data: { usageCount: { increment: 1 } },
      });

      if (count === 0) {
        throw AppException.conflict('This coupon has just been fully redeemed');
      }

      await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId, orderId, discount },
      });
    });
  }

  /** Reverses a redemption when the order it belonged to is cancelled. */
  async release(orderId: string): Promise<void> {
    const redemption = await this.prisma.couponRedemption.findFirst({ where: { orderId } });
    if (!redemption) return;

    await this.prisma.$transaction([
      this.prisma.couponRedemption.delete({ where: { id: redemption.id } }),
      this.prisma.coupon.update({
        where: { id: redemption.couponId },
        data: { usageCount: { decrement: 1 } },
      }),
    ]);
  }

  private discountFor(
    coupon: { type: string; value: number; maxDiscount: number | null },
    itemTotal: number,
  ): number {
    if (coupon.type === 'FLAT') return Math.min(coupon.value, itemTotal);
    if (coupon.type === 'FREE_SHIPPING') return 0;

    // Percentage coupons store basis points, so "15% off" is 1500 and the cap applies
    // after the percentage is taken.
    const raw = applyBps(itemTotal, coupon.value);
    return Math.min(coupon.maxDiscount ?? raw, raw, itemTotal);
  }
}
