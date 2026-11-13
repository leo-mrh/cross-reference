const express = require("express");
const path = require("path");

const app = express();

// Ruta al build de Angular
const distPath = path.join(__dirname, "dist/asistencia-tecnica-digital/browser");

// Servir archivos estáticos
app.use(express.static(distPath));

// ⚠️ FIX: Express 5 no soporta "*" como antes
// Usamos middleware catch-all
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
``