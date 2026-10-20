import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import connection from "../db";
import { AuthRequest } from "../middleware/auth";
import { uploadImage } from "../utils/cloudinaryUpload";

type UserRow = RowDataPacket & {
  id: number;
  role: "admin" | "guru" | "siswa";
};

type UserValue = string | number | null;

const createSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter"),
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(["guru", "siswa"]),
  kelas_id: z
    .preprocess(
      (value) =>
        value === "" || value === null || value === undefined
          ? null
          : Number(value),
      z.number().int().positive().nullable(),
    )
    .optional(),
});

const updateSchema = z
  .object({
    nama: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["guru", "siswa"]).optional(),
    kelas_id: z.preprocess(
      (value) =>
        value === "" || value === null
          ? null
          : value === undefined
            ? undefined
            : Number(value),
      z.number().int().positive().nullable().optional(),
    ),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Tidak ada data untuk diubah",
  });

export async function getUsers(_req: AuthRequest, res: Response) {
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         u.id,
         u.nama,
         u.email,
         u.role,
         u.kelas_id,
         u.foto_profil,
         u.created_at,
         k.nama_kelas
       FROM users u
       LEFT JOIN kelas k ON u.kelas_id = k.id
       WHERE u.role IN ('guru', 'siswa')
       ORDER BY u.id DESC`,
    );

    res.json({ data: rows });
  } catch (error) {
    console.error("Error getUsers:", error);
    res.status(500).json({
      message: "Gagal mengambil pengguna",
    });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        message: "ID tidak valid",
      });
      return;
    }

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         id, nama, email, role, kelas_id,
         foto_profil, created_at
       FROM users
       WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        message: "Pengguna tidak ditemukan",
      });
      return;
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Error getUserById:", error);
    res.status(500).json({
      message: "Gagal mengambil pengguna",
    });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Data tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const { nama, email, password, role, kelas_id } = parsed.data;
    const kelasId = role === "siswa" ? (kelas_id ?? null) : null;

    const [existing] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      res.status(409).json({
        message: "Email sudah terdaftar",
      });
      return;
    }

    if (kelasId !== null) {
      const [classes] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM kelas WHERE id = ?",
        [kelasId],
      );

      if (classes.length === 0) {
        res.status(400).json({
          message: "Kelas tidak ditemukan",
        });
        return;
      }
    }

    const foto = req.file ? await uploadImage(req.file.buffer, "profil") : null;

    const hash = await bcrypt.hash(password, 10);

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users
         (nama, email, password, role, kelas_id, foto_profil)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nama, email, hash, role, kelasId, foto],
    );

    res.status(201).json({
      message: "Akun berhasil dibuat",
      data: {
        id: result.insertId,
        nama,
        email,
        role,
        kelas_id: kelasId,
        foto_profil: foto,
      },
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        message: "Email sudah terdaftar",
      });
      return;
    }

    console.error("Error createUser:", error);
    res.status(500).json({
      message: "Gagal membuat akun",
    });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Data tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        message: "ID tidak valid",
      });
      return;
    }

    const [found] = await connection.execute<UserRow[]>(
      "SELECT id, role FROM users WHERE id = ?",
      [id],
    );

    if (found.length === 0) {
      res.status(404).json({
        message: "Pengguna tidak ditemukan",
      });
      return;
    }

    if (found[0].role === "admin") {
      res.status(403).json({
        message: "Akun admin tidak bisa diubah melalui endpoint ini",
      });
      return;
    }

    const data = parsed.data;
    const role = data.role ?? found[0].role;
    const fields: string[] = [];
    const values: UserValue[] = [];

    if (data.nama !== undefined) {
      fields.push("nama = ?");
      values.push(data.nama);
    }

    if (data.email !== undefined) {
      const [duplicate] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND id <> ?",
        [data.email, id],
      );

      if (duplicate.length > 0) {
        res.status(409).json({
          message: "Email sudah digunakan",
        });
        return;
      }

      fields.push("email = ?");
      values.push(data.email);
    }

    if (data.password !== undefined) {
      const hash = await bcrypt.hash(data.password, 10);
      fields.push("password = ?");
      values.push(hash);
    }

    if (data.role !== undefined) {
      fields.push("role = ?");
      values.push(role);
    }

    if (data.kelas_id !== undefined || data.role !== undefined) {
      let kelasId: number | null = data.kelas_id ?? null;

      if (role === "guru") {
        kelasId = null;
      }

      if (kelasId !== null) {
        const [classes] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM kelas WHERE id = ?",
          [kelasId],
        );

        if (classes.length === 0) {
          res.status(400).json({
            message: "Kelas tidak ditemukan",
          });
          return;
        }
      }

      fields.push("kelas_id = ?");
      values.push(kelasId);
    }

    if (req.file) {
      const foto = await uploadImage(req.file.buffer, "profil");
      fields.push("foto_profil = ?");
      values.push(foto);
    }

    if (fields.length === 0) {
      res.status(400).json({
        message: "Tidak ada data untuk diubah",
      });
      return;
    }

    values.push(id);

    await connection.execute<ResultSetHeader>(
      `UPDATE users
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values,
    );

    res.json({
      message: "Akun berhasil diperbarui",
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        message: "Email sudah digunakan",
      });
      return;
    }

    console.error("Error updateUser:", error);
    res.status(500).json({
      message: "Gagal memperbarui akun",
    });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        message: "ID tidak valid",
      });
      return;
    }

    const [rows] = await connection.execute<UserRow[]>(
      "SELECT id, role FROM users WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        message: "Pengguna tidak ditemukan",
      });
      return;
    }

    if (rows[0].role === "admin") {
      res.status(403).json({
        message: "Akun admin tidak boleh dihapus",
      });
      return;
    }

    await connection.execute<ResultSetHeader>(
      "DELETE FROM users WHERE id = ?",
      [id],
    );

    res.json({
      message: "Akun berhasil dihapus",
    });
  } catch (error: any) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      res.status(409).json({
        message:
          "Akun tidak bisa dihapus karena masih terhubung dengan data lain",
      });
      return;
    }

    console.error("Error deleteUser:", error);
    res.status(500).json({
      message:
        "Gagal menghapus akun. Periksa apakah akun masih terhubung dengan data lain.",
    });
  }
}
