export const createCreateISOTimestampTriggersScript = (table: string, column: string) => {
  const script = `
CREATE TRIGGER "trg_${table}_after_insert_of_${column}_fix_iso_timestamp" AFTER INSERT ON "${table}"
BEGIN
UPDATE "${table}"
SET "${column}" = strftime('%Y-%m-%dT%H:%M:%fZ', NEW."${column}")
WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER "trg_${table}_after_update_of_${column}_fix_iso_timestamp" AFTER UPDATE OF "${column}" ON "${table}"
WHEN NEW."${column}" IS NOT OLD."${column}"
BEGIN
UPDATE "${table}"
SET "${column}" = strftime('%Y-%m-%dT%H:%M:%fZ', NEW."${column}")
WHERE rowid = NEW.rowid;
END;
  `

  return script
}

export const createDropISOTimestampTriggersScript = (table: string, column: string) => {
  const script = `
DROP TRIGGER "trg_${table}_after_insert_of_${column}_fix_iso_timestamp";
DROP TRIGGER "trg_${table}_after_update_of_${column}_fix_iso_timestamp";
  `

  return script
}
