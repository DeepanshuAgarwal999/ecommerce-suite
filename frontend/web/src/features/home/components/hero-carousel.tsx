'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import type { HeroSlide } from '../data';
import { HeroStillLife } from './hero-still-life';

interface HeroCarouselProps {
  slides: HeroSlide[];
}

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  return (
    <section aria-label="Featured offers" className="container pt-3.5 md:pt-7">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: 'start' }}
        className="relative"
      >
        <CarouselContent className="ml-0">
          {slides.map((slide, index) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div
                className={cn(
                  'bg-primary relative grid h-[300px] overflow-hidden rounded-2xl md:h-[420px] md:rounded-[20px]',
                  !slide.image && 'md:grid-cols-2',
                )}
              >
                {slide.image && (
                  <>
                    <Image
                      src={slide.image.src}
                      alt={slide.image.alt}
                      fill
                      priority={index === 0}
                      sizes="(min-width: 1440px) 1280px, 100vw"
                      className="object-cover"
                      style={{ objectPosition: slide.image.position ?? 'center' }}
                    />
                    {/* Scrim keeps white copy legible on any photo and ties it to the brand. */}
                    <div
                      aria-hidden
                      className="from-brand-dark/90 via-brand-dark/55 absolute inset-0 bg-gradient-to-t to-transparent md:bg-gradient-to-r md:via-45% md:to-70%"
                    />
                  </>
                )}

                <div className="relative z-10 flex flex-col items-start justify-end gap-3 p-5 md:justify-center md:gap-5 md:px-16">
                  {slide.eyebrow && (
                    <span className="bg-promo text-promo-foreground inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-extrabold tracking-[0.08em] uppercase md:h-7 md:px-3 md:text-xs">
                      {slide.eyebrow}
                    </span>
                  )}
                  <h1 className="max-w-[250px] text-[30px] leading-[1.06] font-extrabold text-white [text-wrap:balance] md:max-w-none md:text-[54px] md:leading-[1.04]">
                    {slide.headline}
                  </h1>
                  {slide.subcopy && (
                    <p className="hidden max-w-[400px] text-[16.5px] leading-normal text-white/90 md:block">
                      {slide.subcopy}
                    </p>
                  )}
                  <Link
                    href={slide.cta.href}
                    className="text-brand-dark inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[14.5px] font-extrabold transition-transform active:scale-[0.98] md:h-[52px] md:px-[30px] md:text-base"
                  >
                    {slide.cta.label}
                    <ArrowRight className="size-4 md:size-[18px]" strokeWidth={2.4} aria-hidden />
                  </Link>
                </div>

                {!slide.image && (
                  <HeroStillLife className="pointer-events-none absolute inset-y-0 right-[-40px] h-full w-auto opacity-90 md:relative md:right-0 md:w-full md:opacity-100" />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <button
          type="button"
          onClick={() => api?.scrollPrev()}
          aria-label="Previous slide"
          className="absolute top-1/2 left-5 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 shadow-[0_2px_10px_oklch(0.2_0.05_330/0.18)] transition-transform hover:scale-105 md:grid"
        >
          <ChevronLeft className="text-foreground/80 size-5" strokeWidth={2.4} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => api?.scrollNext()}
          aria-label="Next slide"
          className="absolute top-1/2 right-5 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 shadow-[0_2px_10px_oklch(0.2_0.05_330/0.18)] transition-transform hover:scale-105 md:grid"
        >
          <ChevronRight className="text-foreground/80 size-5" strokeWidth={2.4} aria-hidden />
        </button>

        <div
          role="tablist"
          aria-label="Slides"
          className="absolute right-4 bottom-[18px] flex items-center gap-1.5 md:right-auto md:bottom-[22px] md:left-1/2 md:-translate-x-1/2"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === selected}
              aria-label={`Slide ${index + 1}`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                'h-1.5 rounded-full transition-all md:h-[7px]',
                index === selected
                  ? 'w-[18px] bg-white md:w-[26px]'
                  : 'w-1.5 bg-white/45 md:w-[7px]',
              )}
            />
          ))}
        </div>
      </Carousel>
    </section>
  );
}
