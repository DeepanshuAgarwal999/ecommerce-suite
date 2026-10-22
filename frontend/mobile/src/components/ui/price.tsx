import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { discountPercent, formatPrice } from '@/lib/format';
import { Text } from './text';

interface PriceProps {
  pricePaise: number;
  mrpPaise?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Show "23% OFF" next to the struck MRP. */
  showDiscount?: boolean;
}

/** Selling price, struck MRP and the discount - one component so every card agrees. */
export const Price = memo(function Price({ pricePaise, mrpPaise, size = 'md', showDiscount = true }: PriceProps) {
  const off = mrpPaise ? discountPercent(mrpPaise, pricePaise) : 0;
  const fontSize = size === 'lg' ? 22 : size === 'sm' ? 13 : 15;

  return (
    <View style={styles.row} accessible accessibilityLabel={priceLabel(pricePaise, mrpPaise, off)}>
      <Text variant="price" tabular style={{ fontSize, lineHeight: fontSize + 4 }}>
        {formatPrice(pricePaise)}
      </Text>
      {off > 0 && mrpPaise ? (
        <Text variant="caption" tone="mutedForeground" style={styles.mrp}>
          {formatPrice(mrpPaise)}
        </Text>
      ) : null}
      {showDiscount && off > 0 ? (
        <Text variant="captionStrong" tone="success">
          {off}% off
        </Text>
      ) : null}
    </View>
  );
});

function priceLabel(price: number, mrp: number | undefined, off: number): string {
  const base = `Price ${formatPrice(price)}`;
  return off > 0 && mrp ? `${base}, was ${formatPrice(mrp)}, ${off} percent off` : base;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  mrp: { textDecorationLine: 'line-through' },
});
