export const createCreateFTSSyncTriggersScript = (srcTable: string, ftsTable: string, ftsTableType: string | undefined, fields: string[]) => {
  const stateful = !["external", "contentless"].includes(ftsTableType ?? "")

  let fieldsStrRaw = "rowid"
  let fieldsStrSrc = "SRC.rowid"
  let fieldsStrNew = "NEW.rowid"
  let fieldsStrOld = "OLD.rowid"

  const valuesClause = (field: string, table: string) => {
    if (field.startsWith("SELECT")) {
      return `(${field.replace(/\$SRC/g, table)})`
    } else {
      return `${table}."${field}"`
    }
  }

  for (const field of fields) {
    fieldsStrRaw += `, "${field}"`

    fieldsStrSrc += `, ${valuesClause(field, "SRC")}`

    fieldsStrNew += `, ${valuesClause(field, "NEW")}`

    fieldsStrOld += `, ${valuesClause(field, "OLD")}`
  }

  const script = `
${stateful ? `
DELETE FROM "${ftsTable}";
` : `
INSERT INTO "${ftsTable}" (
  "${ftsTable}"
)
VALUES (
  'delete-all'
);
`}

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
  ${stateful ? `
  DELETE FROM "${ftsTable}"
  WHERE rowid = OLD.rowid;
  ` : `
  INSERT INTO "${ftsTable}" (
    "${ftsTable}",
    ${fieldsStrRaw}
  ) VALUES (
    'delete',
    ${fieldsStrOld}
  );
  `}

  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  ) VALUES (
    ${fieldsStrNew}
  );
END;

CREATE TRIGGER "trg_${srcTable}_after_delete_sync_FTS"
AFTER DELETE ON "${srcTable}"
BEGIN
  ${stateful ? `
  DELETE FROM "${ftsTable}"
  WHERE rowid = OLD.rowid;
  ` : `
  INSERT INTO "${ftsTable}" (
    "${ftsTable}",
    ${fieldsStrRaw}
  ) VALUES (
    'delete',
    ${fieldsStrOld}
  );
  `}
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
