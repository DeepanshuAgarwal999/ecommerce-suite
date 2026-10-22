/** What GET /catalog/search/suggest returns (catalog-service ProductService.suggest). */
export interface SuggestCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface SuggestProduct {
  id: string;
  title: string;
  slug: string;
  /** Integer paise. */
  minPrice: number;
  imageUrl: string | null;
}

export interface Suggestions {
  categories: SuggestCategory[];
  products: SuggestProduct[];
}
