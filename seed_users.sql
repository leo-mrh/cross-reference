USE daimler_db;

INSERT IGNORE INTO users (idRol, idArea, sNombre, sApellidoPaterno, sApellidoMaterno, sUsuario, sCorreo, sPassword, bActivo) VALUES
(1, 1, 'UserAdmin', 'System', 'User', 'admin', 'admin@daimler.com', 'b622fa95ae89d334a05d90cff768cae9:JN7y+bJtWlPDJj+/k7wAmbj1b8kOkzgs1hewXSTUz9A=', 1),
(2, 1, 'TestUser', 'User', 'One', 'user', 'user@daimler.com', 'b622fa95ae89d334a05d90cff768cae9:JN7y+bJtWlPDJj+/k7wAmbj1b8kOkzgs1hewXSTUz9A=', 1),
(1, 1, 'Admin', 'Test', 'One', 'admin_test', 'admin_test@daimler.com', '3c963c60fd8ad7d5b9ef20870fc49368:rG9y3LIr6shnzSkU/N2W8jRe1STPZDYQdTixTJusn0s=', 1),
(2, 1, 'User', 'Test', 'Two', 'user_test', 'user_test@daimler.com', '3c963c60fd8ad7d5b9ef20870fc49368:rG9y3LIr6shnzSkU/N2W8jRe1STPZDYQdTixTJusn0s=', 1),
(1, 1, 'Admin', 'DB', 'User', 'admin_db', 'admin_db@daimler.com', '3c963c60fd8ad7d5b9ef20870fc49368:rG9y3LIr6shnzSkU/N2W8jRe1STPZDYQdTixTJusn0s=', 1),
(2, 1, 'Standard', 'DB', 'User', 'user_db', 'user_db@daimler.com', '3c963c60fd8ad7d5b9ef20870fc49368:rG9y3LIr6shnzSkU/N2W8jRe1STPZDYQdTixTJusn0s=', 1);
