export const createCreateFTSSyncTriggersScript = (srcTable: string, ftsTable: string, fields: string[]) => {
  let fieldsStrRaw = "rowid"
  let fieldsStrSrc = "SRC.rowid"
  let fieldsStrNew = "NEW.rowid"
  let fieldsStrOld = "OLD.rowid"

  const values_clause = (field: string, table: string) => {
    if (field.startsWith("SELECT")) {
      return `(${field.replace(/\$SRC/g, table)})`
    } else {
      return `${table}."${field}"`
    }
  }

  for (const field of fields) {
    fieldsStrRaw += `, "${field}"`

    fieldsStrSrc += `, ${values_clause(field, "SRC")}`

    fieldsStrNew += `, ${values_clause(field, "NEW")}`

    fieldsStrOld += `, ${values_clause(field, "OLD")}`
  }

  const script = `
INSERT INTO "${ftsTable}" (
  "${ftsTable}"
)
VALUES (
  'delete-all'
);

INSERT INTO "${ftsTable}" (
  ${fieldsStrRaw}
)
SELECT
  ${fieldsStrSrc}
FROM "${srcTable}" SRC;

CREATE TRIGGER "trg_${srcTable}_after_insert_sync_FTS"
AFTER INSERT ON "${srcTable}"
BEGIN
  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  ) VALUES (
    ${fieldsStrNew}
  );
END;

CREATE TRIGGER "trg_${srcTable}_after_update_sync_FTS"
AFTER UPDATE ON "${srcTable}"
BEGIN
  INSERT INTO "${ftsTable}" (
    "${ftsTable}",
    ${fieldsStrRaw}
  ) VALUES (
    'delete',
    ${fieldsStrOld}
  );

  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  ) VALUES (
    ${fieldsStrNew}
  );
END;

CREATE TRIGGER "trg_${srcTable}_after_delete_sync_FTS"
AFTER DELETE ON "${srcTable}"
BEGIN
  INSERT INTO "${ftsTable}" (
    "${ftsTable}",
    ${fieldsStrRaw}
  ) VALUES (
    'delete',
    ${fieldsStrOld}
  );
END;
  `

  return script
}

export const createDropFTSSyncTriggersScript = (srcTable: string) => {
  const script = `
DROP TRIGGER "trg_${srcTable}_after_insert_sync_FTS";
DROP TRIGGER "trg_${srcTable}_after_update_sync_FTS";
DROP TRIGGER "trg_${srcTable}_after_delete_sync_FTS";
  `

  return script
}
