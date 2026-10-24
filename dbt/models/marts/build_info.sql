-- One row describing the import. The pipeline fills product, fetch time and opendata commit
-- through vars; publish_postgres adds per-table row counts as JSON.
select
    '{{ var("wago_build") }}'                       as build,
    '{{ var("wago_product", "") }}'                 as product,
    '{{ var("fetched_at", "") }}'                   as fetched_at,
    '{{ var("opendata_commit", "") }}'              as opendata_commit,
    strftime(now(), '%Y-%m-%dT%H:%M:%SZ')           as imported_at
