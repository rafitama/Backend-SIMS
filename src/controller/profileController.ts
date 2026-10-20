import { Response } from "express";
import { z } from "zod";
import connection from "../db";
import { AuthRequest } from "../middleware/auth";
import { uploadImage } from "../utils/cloudinaryUpload";

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const [rows]: any = await connection.execute(
      `SELECT id,nama,email,role,kelas_id,foto_profil,created_at
       FROM users WHERE id=?`,
      [req.user!.id],
    );

    if (!rows.length) {
      res.status(404).json({ message: "Profil tidak ditemukan" });
      return;
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil profil" });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const schema = z
    .object({
      nama: z.string().trim().min(3).optional(),
    })
    .refine((data) => data.nama !== undefined || Boolean(req.file), {
      message: "Isi nama atau pilih foto",
    });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        message: "Data tidak valid",
        errors: parsed.error.flatten().fieldErrors,
      });
    return;
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (parsed.data.nama !== undefined) {
      fields.push("nama=?");
      values.push(parsed.data.nama);
    }

    if (req.file) {
      fields.push("foto_profil=?");
      values.push(await uploadImage(req.file.buffer, "profil"));
    }

    values.push(req.user!.id);
    await connection.execute(
      `UPDATE users SET ${fields.join(",")} WHERE id=?`,
      values,
    );

    const [rows]: any = await connection.execute(
      `SELECT id,nama,email,role,kelas_id,foto_profil,created_at
       FROM users WHERE id=?`,
      [req.user!.id],
    );

    res.json({ message: "Profil berhasil diperbarui", data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal memperbarui profil" });
  }
}
