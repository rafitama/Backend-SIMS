import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import connection from "../db";
import { AuthRequest } from "../middleware/auth";

const registerSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  kelas: z.string().trim().min(1, "Nama kelas wajib diisi").max(50),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Data tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { nama, email, password } = parsed.data;
  const namaKelas = parsed.data.kelas.toUpperCase();

  let db: Awaited<ReturnType<typeof connection.getConnection>> | undefined;
  let transactionStarted = false;

  try {
    db = await connection.getConnection();

    const [existing]: any = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      res.status(409).json({
        message: "Email sudah terdaftar",
      });
      return;
    }

    await db.beginTransaction();
    transactionStarted = true;

    let [kelasRows]: any = await db.execute(
      "SELECT id FROM kelas WHERE nama_kelas = ? FOR UPDATE",
      [namaKelas],
    );

    if (kelasRows.length === 0) {
      await db.execute("INSERT INTO kelas (nama_kelas) VALUES (?)", [
        namaKelas,
      ]);

      [kelasRows] = await db.execute(
        "SELECT id FROM kelas WHERE nama_kelas = ?",
        [namaKelas],
      );
    }

    if (!kelasRows.length) {
      throw new Error("Gagal mendapatkan ID kelas");
    }

    const kelasId = kelasRows[0].id;
    const hash = await bcrypt.hash(password, 10);

    await db.execute(
      `INSERT INTO users
        (nama, email, password, role, kelas_id)
       VALUES (?, ?, ?, 'siswa', ?)`,
      [nama, email, hash, kelasId],
    );

    await db.commit();
    transactionStarted = false;

    res.status(201).json({
      message: "Registrasi siswa berhasil",
    });
  } catch (error: any) {
    if (transactionStarted && db) {
      try {
        await db.rollback();
      } catch (rollbackError) {
        console.error("Error rollback register:", rollbackError);
      }
    }

    // 1062 = duplicate entry dari MySQL
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        message: "Email atau data unik sudah terdaftar",
      });
      return;
    }

    console.error("Error register:", error);

    res.status(500).json({
      message: "Gagal mendaftarkan siswa",
    });
  } finally {
    db?.release();
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Data tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { email, password } = parsed.data;

    const [rows]: any = await connection.execute(
      `SELECT id, nama, email, password, role, kelas_id
       FROM users
       WHERE email = ?`,
      [email],
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({
        message: "Email atau password salah",
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET belum dikonfigurasi");

      res.status(500).json({
        message: "Server belum dikonfigurasi dengan benar",
      });
      return;
    }

    const token = jwt.sign(
      {
        id: Number(user.id),
        role: user.role,
      },
      secret,
      {
        expiresIn: "1d",
      },
    );

    res.json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        kelas_id: user.kelas_id,
      },
    });
  } catch (error) {
    console.error("Error login:", error);

    res.status(500).json({
      message: "Gagal login",
    });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "Token tidak valid",
      });
      return;
    }

    const [rows]: any = await connection.execute(
      `SELECT
         u.id, u.nama, u.email, u.role, u.kelas_id,
         u.foto_profil, u.created_at, k.nama_kelas
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.id = ?`,
      [req.user.id],
    );

    if (!rows.length) {
      res.status(404).json({
        message: "User tidak ditemukan",
      });
      return;
    }

    res.json({
      message: "Profil berhasil diambil",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error getMe:", error);

    res.status(500).json({
      message: "Gagal mengambil profil",
    });
  }
}
