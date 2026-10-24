{#-
  Copy every mart model built successfully in this run from DuckDB into data/wow.sqlite,
  the file the app, the API and MCP read. Each table is replaced whole, so a partial run
  (dbt build -s items) refreshes only the tables it built.

  Per-model meta:
    sqlite_primary_key: column    -> UNIQUE index (the row id)
    sqlite_indexes: [col, ...]    -> plain indexes for lookups and joins
-#}
{% macro publish_sqlite(path=var('sqlite_path', '../data/wow.sqlite')) %}
  {% if not execute %}{{ return('') }}{% endif %}
  {% set marts = [] %}
  {% for res in results %}
    {% if res.node.resource_type == 'model' and res.node.fqn[1] == 'marts' and res.status == 'success' %}
      {% do marts.append(res.node) %}
    {% endif %}
  {% endfor %}
  {% if marts | length == 0 %}{{ return('') }}{% endif %}

  {% do run_query("INSTALL sqlite; LOAD sqlite; ATTACH '" ~ path ~ "' AS pub (TYPE sqlite)") %}
  {% for node in marts %}
    {% set src = adapter.get_relation(database=node.database, schema=node.schema, identifier=node.alias) %}
    {% set name = node.alias %}
    {% set meta = node.config.meta or {} %}
    {% do run_query('DROP TABLE IF EXISTS pub."' ~ name ~ '"') %}
    {% do run_query('CREATE TABLE pub."' ~ name ~ '" AS SELECT * FROM ' ~ src) %}
    {% if meta.get('sqlite_primary_key') %}
      {% do run_query('CREATE UNIQUE INDEX "pk_' ~ name ~ '" ON pub.main."' ~ name ~ '" ("' ~ meta['sqlite_primary_key'] ~ '")') %}
    {% endif %}
    {% for col in meta.get('sqlite_indexes', []) %}
      {% do run_query('CREATE INDEX "ix_' ~ name ~ '_' ~ col ~ '" ON pub.main."' ~ name ~ '" ("' ~ col ~ '")') %}
    {% endfor %}
    {{ log("published " ~ name ~ " -> " ~ path, info=true) }}
  {% endfor %}
  {% do run_query("DETACH pub") %}
  {{ return('') }}
{% endmacro %}
