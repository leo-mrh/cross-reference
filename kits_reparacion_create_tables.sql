IF SCHEMA_ID('aftersales') IS NULL
BEGIN
  EXEC('CREATE SCHEMA aftersales');
END

IF OBJECT_ID('aftersales.kits_reparacion', 'U') IS NULL
BEGIN
  CREATE TABLE aftersales.kits_reparacion (
    id INT IDENTITY(1,1) NOT NULL,
    numeroEnsamble VARCHAR(255) NOT NULL,
    descripcion VARCHAR(255) NULL,
    imagen VARCHAR(255) NULL,
    CONSTRAINT PK_kits_reparacion PRIMARY KEY (id),
    CONSTRAINT UQ_kits_reparacion_numeroEnsamble UNIQUE (numeroEnsamble)
  );
END

IF OBJECT_ID('aftersales.kits_reparacion_items', 'U') IS NULL
BEGIN
  CREATE TABLE aftersales.kits_reparacion_items (
    id INT IDENTITY(1,1) NOT NULL,
    numeroParte VARCHAR(255) NOT NULL,
    sucesor VARCHAR(255) NULL,
    descripcion VARCHAR(255) NULL,
    cantidad INT NOT NULL CONSTRAINT DF_kits_rep_items_cantidad DEFAULT (1),
    kitId INT NOT NULL,
    CONSTRAINT PK_kits_reparacion_items PRIMARY KEY (id)
  );
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_kits_rep_items_kit'
)
BEGIN
  ALTER TABLE aftersales.kits_reparacion_items
  ADD CONSTRAINT FK_kits_rep_items_kit
  FOREIGN KEY (kitId) REFERENCES aftersales.kits_reparacion(id) ON DELETE CASCADE;
END
