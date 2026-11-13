IF COL_LENGTH('aftersales.kits_reparacion', 'imagen') IS NULL
BEGIN
  ALTER TABLE aftersales.kits_reparacion
  ADD imagen VARCHAR(255) NULL;
END

