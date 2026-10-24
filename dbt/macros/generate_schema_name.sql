{#- Use the custom schema as-is (staging, intermediate, ref) instead of dbt's
    default "<target>_<custom>"; models without one land in the target schema (main). -#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}{{ target.schema }}{%- else -%}{{ custom_schema_name | trim }}{%- endif -%}
{%- endmacro %}
