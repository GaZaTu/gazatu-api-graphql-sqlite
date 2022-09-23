const fieldsToStrings = (fields: string[]) => {
  let fieldsStrRaw = "rowid"
  let fieldsStrSrc = "SRC.rowid"
  let fieldsStrNew = "NEW.rowid"

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
  }

  return {
    fieldsStrRaw,
    fieldsStrSrc,
    fieldsStrNew,
  }
}

export const createCreateFTSSyncTriggersScript = (srcTable: string, ftsTable: string, fields: string[]) => {
  const {
    fieldsStrRaw,
    fieldsStrSrc,
    fieldsStrNew,
  } = fieldsToStrings(fields)

  const script = `
DELETE FROM "${ftsTable}";

INSERT INTO "${ftsTable}" (
  ${fieldsStrRaw}
)
SELECT
  ${fieldsStrSrc}
FROM "${srcTable}" SRC;

CREATE TRIGGER "trg_${srcTable}_after_insert_sync_${ftsTable}"
AFTER INSERT ON "${srcTable}" FOR EACH ROW
BEGIN
  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  ) VALUES (
    ${fieldsStrNew}
  );
END;

CREATE TRIGGER "trg_${srcTable}_after_update_sync_${ftsTable}"
AFTER UPDATE OF ${fieldsStrRaw} ON "${srcTable}" FOR EACH ROW
BEGIN
  DELETE FROM "${ftsTable}"
  WHERE rowid = OLD.rowid;

  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  ) VALUES (
    ${fieldsStrNew}
  );
END;

CREATE TRIGGER "trg_${srcTable}_after_delete_sync_${ftsTable}"
AFTER DELETE ON "${srcTable}" FOR EACH ROW
BEGIN
  DELETE FROM "${ftsTable}"
  WHERE rowid = OLD.rowid;
END;
  `

  return script
}

export const createDropFTSSyncTriggersScript = (srcTable: string, ftsTable: string) => {
  const script = `
DROP TRIGGER "trg_${srcTable}_after_insert_sync_${ftsTable}";
DROP TRIGGER "trg_${srcTable}_after_update_sync_${ftsTable}";
DROP TRIGGER "trg_${srcTable}_after_delete_sync_${ftsTable}";
  `

  return script
}

export const createCreateFTSSyncTriggersN2MScript = (srcTable: string, ftsTable: string, n2mTable: string, srcId: string, n2mId: string, fields: string[]) => {
  const {
    fieldsStrRaw,
    fieldsStrSrc,
  } = fieldsToStrings(fields)

  const script = `
CREATE TRIGGER "trg_${n2mTable}_after_insert_sync_${ftsTable}"
AFTER INSERT ON "${n2mTable}" FOR EACH ROW
BEGIN
  DELETE FROM "${ftsTable}"
  WHERE rowid = (SELECT rowid FROM "${srcTable}" WHERE "${srcId}" = NEW."${n2mId}");

  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  )
  SELECT
    ${fieldsStrSrc.replace(`SRC.${srcId}`, `NEW.${n2mId}`)}
  FROM "${srcTable}" SRC
  WHERE "${srcId}" = NEW."${n2mId}";
END;

CREATE TRIGGER "trg_${n2mTable}_after_delete_sync_${ftsTable}"
AFTER DELETE ON "${n2mTable}" FOR EACH ROW
BEGIN
  DELETE FROM "${ftsTable}"
  WHERE rowid = (SELECT rowid FROM "${srcTable}" WHERE "${srcId}" = OLD."${n2mId}");

  INSERT INTO "${ftsTable}" (
    ${fieldsStrRaw}
  )
  SELECT
  ${fieldsStrSrc.replace(`SRC.${srcId}`, `OLD.${n2mId}`)}
  FROM "${srcTable}" SRC
  WHERE "${srcId}" = OLD."${n2mId}";
END;
  `

  return script
}

export const createDropFTSSyncTriggersN2MScript = (srcTable: string, ftsTable: string, n2mTable: string) => {
  const script = `
DROP TRIGGER "trg_${n2mTable}_after_insert_sync_${ftsTable}";
DROP TRIGGER "trg_${n2mTable}_after_update_sync_${ftsTable}";
DROP TRIGGER "trg_${n2mTable}_after_delete_sync_${ftsTable}";
  `

  return script
}
