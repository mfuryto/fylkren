using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261002110000_AddTaskReferenceSystem")]
public sealed class AddTaskReferenceSystem : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE platform_reference_settings (
                key integer PRIMARY KEY,
                minimum_digits integer NOT NULL,
                next_number bigint NOT NULL,
                updated_at timestamp with time zone NOT NULL,
                updated_by uuid NULL,
                CONSTRAINT ck_platform_reference_settings_key CHECK (key = 1),
                CONSTRAINT ck_platform_reference_settings_digits CHECK (minimum_digits BETWEEN 3 AND 10),
                CONSTRAINT ck_platform_reference_settings_next CHECK (next_number BETWEEN 1 AND 9999999999)
            );

            INSERT INTO platform_reference_settings (key, minimum_digits, next_number, updated_at)
            VALUES (1, 6, 1, CURRENT_TIMESTAMP);

            CREATE TABLE site_reference_settings (
                site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE RESTRICT,
                prefix character varying(12) NOT NULL,
                updated_at timestamp with time zone NOT NULL,
                updated_by uuid NULL
            );
            CREATE UNIQUE INDEX ix_site_reference_settings_prefix ON site_reference_settings(prefix);

            INSERT INTO site_reference_settings (site_id, prefix, updated_at)
            SELECT id, 'S' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 7)), CURRENT_TIMESTAMP
            FROM sites;

            ALTER TABLE work_item_types ADD COLUMN abbreviation character varying(12);
            WITH candidates AS (
                SELECT id, site_id, is_system_managed, normalized_name,
                       UPPER(SUBSTRING(REGEXP_REPLACE(normalized_name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3)) AS base
                FROM work_item_types
            ), ranked AS (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY site_id, base
                    ORDER BY is_system_managed DESC, id) AS duplicate_number
                FROM candidates
            )
            UPDATE work_item_types type
            SET abbreviation = CASE
                WHEN ranked.is_system_managed AND ranked.normalized_name = 'REQUEST' THEN 'REQ'
                WHEN LENGTH(ranked.base) >= 2 AND ranked.base ~ '^[A-Z]'
                    THEN ranked.base || CASE WHEN ranked.duplicate_number = 1 THEN '' ELSE ranked.duplicate_number::text END
                ELSE 'T' || UPPER(SUBSTRING(REPLACE(ranked.id::text, '-', '') FROM 1 FOR 7))
            END
            FROM ranked
            WHERE type.id = ranked.id;
            ALTER TABLE work_item_types ALTER COLUMN abbreviation SET NOT NULL;
            CREATE UNIQUE INDEX ix_work_item_types_site_id_abbreviation
                ON work_item_types(site_id, abbreviation);

            ALTER TABLE work_items ADD COLUMN reference_code character varying(80);
            ALTER TABLE work_items ADD COLUMN reference_number bigint;
            ALTER TABLE work_items ADD COLUMN origin_reference character varying(80);
            ALTER TABLE work_items ADD COLUMN origin_reference_instance_id uuid;

            WITH RECURSIVE roots AS (
                SELECT id, site_id,
                       ROW_NUMBER() OVER (ORDER BY created_at, id) AS sequence
                FROM work_items
                WHERE parent_work_item_id IS NULL
            ), siblings AS (
                SELECT id, parent_work_item_id,
                       ROW_NUMBER() OVER (PARTITION BY parent_work_item_id ORDER BY created_at, id) AS sequence
                FROM work_items
                WHERE parent_work_item_id IS NOT NULL
            ), reference_tree AS (
                SELECT root.id, root.site_id, root.sequence,
                       COALESCE(type.abbreviation, settings.prefix) || '-' || LPAD(root.sequence::text, 6, '0') AS reference_code
                FROM roots root
                JOIN site_reference_settings settings ON settings.site_id = root.site_id
                JOIN work_items root_item ON root_item.id = root.id
                LEFT JOIN work_item_types type ON type.id = root_item.work_item_type_id
                UNION ALL
                SELECT child.id, item.site_id, child.sequence,
                       parent.reference_code || '-' || child.sequence::text
                FROM reference_tree parent
                JOIN siblings child ON child.parent_work_item_id = parent.id
                JOIN work_items item ON item.id = child.id
            )
            UPDATE work_items item
            SET reference_number = reference_tree.sequence,
                reference_code = reference_tree.reference_code
            FROM reference_tree
            WHERE item.id = reference_tree.id;

            UPDATE platform_reference_settings
            SET next_number = COALESCE((
                SELECT MAX(item.reference_number) + 1 FROM work_items item
                WHERE item.parent_work_item_id IS NULL
            ), 1)
            WHERE key = 1;

            ALTER TABLE work_items ALTER COLUMN reference_code SET NOT NULL;
            ALTER TABLE work_items ALTER COLUMN reference_number SET NOT NULL;
            CREATE UNIQUE INDEX ix_work_items_reference_code ON work_items(reference_code);
            CREATE INDEX ix_work_items_site_id_reference_number ON work_items(site_id, reference_number);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ix_work_items_site_id_reference_number;
            DROP INDEX IF EXISTS ix_work_items_reference_code;
            ALTER TABLE work_items DROP COLUMN IF EXISTS origin_reference_instance_id;
            ALTER TABLE work_items DROP COLUMN IF EXISTS origin_reference;
            ALTER TABLE work_items DROP COLUMN IF EXISTS reference_number;
            ALTER TABLE work_items DROP COLUMN IF EXISTS reference_code;
            DROP INDEX IF EXISTS ix_work_item_types_site_id_abbreviation;
            ALTER TABLE work_item_types DROP COLUMN IF EXISTS abbreviation;
            DROP TABLE IF EXISTS site_reference_settings;
            DROP TABLE IF EXISTS platform_reference_settings;
            """);
    }
}
