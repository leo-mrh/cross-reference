IF COL_LENGTH('aftersales.kits_reparacion_items', 'imagen') IS NULL
BEGIN
  ALTER TABLE aftersales.kits_reparacion_items
  ADD imagen VARCHAR(255) NULL;
END
