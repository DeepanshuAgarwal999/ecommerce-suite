import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CartPatterns, RequestContext } from '@ecommerce/contracts';
import { CartService } from './cart/cart.service';
import {
  AddItemDto,
  ApplyCouponDto,
  CheckoutSnapshotDto,
  ToggleWishlistDto,
  UpdateItemDto,
} from '@ecommerce/contracts';
import { WishlistService } from './wishlist/wishlist.service';

@Controller()
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly wishlist: WishlistService,
  ) {}

  @MessagePattern(CartPatterns.GET_CART)
  getCart(@Payload() msg: { userId: string; pincode?: string }) {
    return this.cart.getCart(msg.userId, { pincode: msg.pincode });
  }

  @MessagePattern(CartPatterns.ADD_ITEM)
  addItem(@Payload() msg: { userId: string; dto: AddItemDto; pincode?: string }) {
    return this.cart.addItem(msg.userId, msg.dto, msg.pincode);
  }

  @MessagePattern(CartPatterns.UPDATE_ITEM)
  updateItem(
    @Payload() msg: { userId: string; itemId: string; dto: UpdateItemDto; pincode?: string },
  ) {
    return this.cart.updateItem(msg.userId, msg.itemId, msg.dto, msg.pincode);
  }

  @MessagePattern(CartPatterns.REMOVE_ITEM)
  removeItem(@Payload() msg: { userId: string; itemId: string; pincode?: string }) {
    return this.cart.removeItem(msg.userId, msg.itemId, msg.pincode);
  }

  @MessagePattern(CartPatterns.CLEAR)
  clear(@Payload() msg: { userId: string }) {
    return this.cart.clear(msg.userId);
  }

  @MessagePattern(CartPatterns.APPLY_COUPON)
  applyCoupon(@Payload() msg: { userId: string; dto: ApplyCouponDto; pincode?: string }) {
    return this.cart.applyCoupon(msg.userId, msg.dto.code, msg.pincode);
  }

  @MessagePattern(CartPatterns.REMOVE_COUPON)
  removeCoupon(@Payload() msg: { userId: string; pincode?: string }) {
    return this.cart.removeCoupon(msg.userId, msg.pincode);
  }

  @MessagePattern(CartPatterns.CHECKOUT_SNAPSHOT)
  checkoutSnapshot(
    @Payload() msg: { userId: string; dto: CheckoutSnapshotDto; ctx: RequestContext },
  ) {
    return this.cart.checkoutSnapshot(
      msg.userId,
      {
        addressId: msg.dto.addressId,
        pincode: msg.dto.pincode,
        paymentMethod: msg.dto.paymentMethod,
        items: msg.dto.items,
      },
      msg.ctx,
    );
  }

  @MessagePattern(CartPatterns.ADMIN_PRODUCT_WISHLIST)
  productWishlist(@Payload() msg: { productId: string; months: number }) {
    return this.wishlist.productWishlist(msg.productId, msg.months);
  }

  @MessagePattern(CartPatterns.ADMIN_TOP_WISHLISTED)
  topWishlisted(@Payload() msg: { days: number }) {
    return this.wishlist.topWishlisted(msg.days);
  }

  @MessagePattern(CartPatterns.GET_WISHLIST)
  getWishlist(@Payload() msg: { userId: string; page?: number; limit?: number }) {
    return this.wishlist.list(msg.userId, msg);
  }

  @MessagePattern(CartPatterns.TOGGLE_WISHLIST)
  toggleWishlist(@Payload() msg: { userId: string; dto: ToggleWishlistDto }) {
    return this.wishlist.toggle(msg.userId, msg.dto);
  }
}
