import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: "admin" | "guru" | "siswa";
  };
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Token tidak ditemukan",
    });
    return;
  }

  const token = header.slice(7).trim();

  if (!token) {
    res.status(401).json({
      message: "Token tidak ditemukan",
    });
    return;
  }

  if (!secret) {
    res.status(500).json({
      message: "JWT_SECRET belum diatur",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      typeof decoded.id !== "number" ||
      !Number.isInteger(decoded.id) ||
      decoded.id < 1 ||
      !["admin", "guru", "siswa"].includes(decoded.role as string)
    ) {
      res.status(401).json({
        message: "Token tidak valid",
      });
      return;
    }

    req.user = {
      id: decoded.id,
      role: decoded.role as "admin" | "guru" | "siswa",
    };

    next();
  } catch {
    res.status(401).json({
      message: "Token tidak valid atau kedaluwarsa",
    });
  }
}

export function allowRoles(...roles: ("admin" | "guru" | "siswa")[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        message: "Akses ditolak",
      });
      return;
    }

    next();
  };
}
