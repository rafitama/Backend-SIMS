import "dotenv/config";

import express from "express";
import cors from "cors";

import auth from "./routes/auth";
import users from "./routes/users";
import profile from "./routes/profile";
import konten from "./routes/konten";
import kelas from "./routes/kelas";

import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", auth);
app.use("/api/users", users);
app.use("/api/profile", profile);
app.use("/api/konten", konten);
app.use("/api/kelas", kelas);

app.get("/", (_req, res) => {
  res.json({
    message: "SIMS API berjalan",
  });
});

// Route yang tidak ditemukan
app.use(notFoundHandler);

// Error handler harus paling akhir
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server berjalan di port ${port}`);
  });
}

export default app;
