import { Request, Response, NextFunction } from "express";
import multer from "multer";

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
}

export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (res.headersSent) {
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        message: "Ukuran gambar maksimal 5 MB",
      });
      return;
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        message: "Hanya boleh mengunggah satu file",
      });
      return;
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        message: "Field upload tidak sesuai atau file terlalu banyak",
      });
      return;
    }

    res.status(400).json({
      message: "Upload file gagal",
    });
    return;
  }

  if (
    error instanceof Error &&
    error.message === "Gunakan gambar JPG, PNG, atau WEBP"
  ) {
    res.status(400).json({
      message: error.message,
    });
    return;
  }

  console.error("Unhandled error:", error);

  res.status(500).json({
    message: "Terjadi kesalahan pada server",
  });
}
