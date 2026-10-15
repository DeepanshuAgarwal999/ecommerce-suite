-- Product full-text search plumbing that Prisma's schema language cannot express.
--
-- schema.prisma declares the `searchVector` column and its GIN index; this file adds
-- the triggers that keep the vector in step with the data, and backfills it. It is
-- idempotent and is re-applied automatically after every `db push`
-- (tools/scripts/prisma.mjs runs every prisma/sql/*.sql), so it cannot drift.
--
-- Weights: title A > category name + keywords B > vendor C > description D, which
-- ts_rank turns into "a title hit beats a description hit". The category name is in
-- the document so "kitchen" finds a "Cast Iron Kadai" filed under Kitchen & Dining.
-- The 'english' config stems ("cushions" -> "cushion"); non-English product words
-- (dohar, urli) pass through unchanged, and typos are caught separately by the
-- pg_trgm index on title.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- v1 signature (no category) - superseded below.
DROP FUNCTION IF EXISTS products_search_vector(text, text[], text, text);

CREATE OR REPLACE FUNCTION products_search_vector(
  title text, keywords text[], category text, vendor text, description text
) RETURNS tsvector LANGUAGE sql IMMUTABLE AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '') || ' ' || coalesce(array_to_string(keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(vendor, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(description, ''), 2000)), 'D')
$$;

-- Product rows: recompute on insert and whenever a searchable column changes.
CREATE OR REPLACE FUNCTION products_search_vector_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchVector" := products_search_vector(
    NEW."title",
    NEW."searchKeywords",
    (SELECT c."name" FROM "categories" c WHERE c."id" = NEW."categoryId"),
    NEW."vendorName",
    NEW."description"
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS products_search_vector_update ON "products";
CREATE TRIGGER products_search_vector_update
  BEFORE INSERT OR UPDATE OF "title", "searchKeywords", "categoryId", "vendorName", "description"
  ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_trigger();

-- Category renamed: refresh the vectors of the products filed under it.
CREATE OR REPLACE FUNCTION categories_search_vector_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "products" p
  SET "searchVector" = products_search_vector(p."title", p."searchKeywords", NEW."name", p."vendorName", p."description")
  WHERE p."categoryId" = NEW."id";
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS categories_search_vector_update ON "categories";
CREATE TRIGGER categories_search_vector_update
  AFTER UPDATE OF "name" ON "categories"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
  EXECUTE FUNCTION categories_search_vector_trigger();

-- Backfill: brings every row up to the current definition. Only rows whose vector
-- actually differs are written, so re-running after an unchanged push is a read-only scan.
UPDATE "products" p
SET "searchVector" = v.vector
FROM (
  SELECT p2."id",
         products_search_vector(p2."title", p2."searchKeywords", c."name", p2."vendorName", p2."description") AS vector
  FROM "products" p2
  LEFT JOIN "categories" c ON c."id" = p2."categoryId"
) v
WHERE v."id" = p."id" AND p."searchVector" IS DISTINCT FROM v.vector;
