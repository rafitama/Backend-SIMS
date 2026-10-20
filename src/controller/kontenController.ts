import { Response } from "express";
import { z } from "zod";
import connection from "../db";
import { AuthRequest } from "../middleware/auth";
import { uploadImage } from "../utils/cloudinaryUpload";
import { parseDeadline } from "../utils/parseDeadline";

const contentSchema = z.object({
  judul: z.string().trim().min(3, "Judul minimal 3 karakter"),
  deskripsi: z.string().trim().min(1, "Deskripsi wajib diisi"),
  jenis: z.enum(["materi", "tugas"]),
  kelas_id: z.coerce.number().int().positive(),
  deadline: z.string().optional(),
});

export async function getKonten(req: AuthRequest, res: Response) {
  try {
    let sql = `
      SELECT
        t.id, t.judul, t.deskripsi, t.jenis, t.gambar,
        t.deadline, t.guru_id, t.kelas_id, t.created_at,
        k.nama_kelas, u.nama AS nama_guru
      FROM tugas t
      JOIN kelas k ON k.id = t.kelas_id
      JOIN users u ON u.id = t.guru_id
    `;

    const params: (number | string)[] = [];

    if (req.user!.role === "siswa") {
      const [users]: any = await connection.execute(
        "SELECT kelas_id FROM users WHERE id = ?",
        [req.user!.id],
      );

      if (!users.length || users[0].kelas_id === null) {
        res.json({ data: [] });
        return;
      }

      sql += " WHERE t.kelas_id = ?";
      params.push(users[0].kelas_id);
    } else if (req.user!.role === "guru") {
      sql += " WHERE t.guru_id = ?";
      params.push(req.user!.id);
    }

    sql += " ORDER BY t.created_at DESC";

    const [rows] = await connection.execute(sql, params);
    res.json({ data: rows });
  } catch (error) {
    console.error("Error getKonten:", error);
    res.status(500).json({
      message: "Gagal mengambil materi dan tugas",
    });
  }
}

export async function createKonten(req: AuthRequest, res: Response) {
  const parsed = contentSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Data tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { judul, deskripsi, jenis, kelas_id, deadline } = parsed.data;

  let deadlineValue: string | null = null;

  if (jenis === "tugas") {
    if (!deadline) {
      res.status(400).json({
        message: "Deadline wajib untuk tugas",
      });
      return;
    }

    deadlineValue = parseDeadline(deadline);

    if (!deadlineValue) {
      res.status(400).json({
        message: "Format deadline harus YYYY-MM-DD dan tanggal harus valid",
      });
      return;
    }
  }

  if (jenis === "materi" && deadline) {
    res.status(400).json({
      message: "Materi tidak menggunakan deadline",
    });
    return;
  }

  try {
    const [classes]: any = await connection.execute(
      "SELECT id FROM kelas WHERE id = ?",
      [kelas_id],
    );

    if (!classes.length) {
      res.status(400).json({
        message: "Kelas tidak ditemukan",
      });
      return;
    }

    const gambar: string | null = req.file
      ? await uploadImage(req.file.buffer, "konten")
      : null;

    const [result]: any = await connection.execute(
      `INSERT INTO tugas
        (judul, deskripsi, jenis, gambar, deadline, guru_id, kelas_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [judul, deskripsi, jenis, gambar, deadlineValue, req.user!.id, kelas_id],
    );

    res.status(201).json({
      message: "Konten berhasil dibuat",
      data: {
        id: result.insertId,
        judul,
        deskripsi,
        jenis,
        gambar,
        deadline: deadlineValue,
        guru_id: req.user!.id,
        kelas_id,
      },
    });
  } catch (error) {
    console.error("Error createKonten:", error);
    res.status(500).json({
      message: "Gagal membuat konten",
    });
  }
}

export async function updateKonten(req: AuthRequest, res: Response) {
  const parsed = contentSchema.partial().safeParse(req.body);

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
      res.status(400).json({ message: "ID tidak valid" });
      return;
    }

    const [rows]: any = await connection.execute(
      "SELECT * FROM tugas WHERE id = ?",
      [id],
    );

    if (!rows.length) {
      res.status(404).json({ message: "Konten tidak ditemukan" });
      return;
    }

    const content = rows[0];

    if (req.user!.role !== "guru" || Number(content.guru_id) !== req.user!.id) {
      res.status(403).json({
        message: "Hanya guru pemilik konten yang dapat mengubahnya",
      });
      return;
    }

    const data = parsed.data;
    const judul = data.judul ?? content.judul;
    const deskripsi = data.deskripsi ?? content.deskripsi;
    const jenis = data.jenis ?? content.jenis;
    const kelasId = data.kelas_id ?? content.kelas_id;

    let deadlineValue: string | null = null;

    if (jenis === "tugas") {
      const deadlineInput =
        data.deadline !== undefined
          ? data.deadline
          : content.deadline == null
            ? ""
            : String(content.deadline).slice(0, 10);

      if (!deadlineInput) {
        res.status(400).json({
          message: "Tugas harus memiliki deadline",
        });
        return;
      }

      deadlineValue = parseDeadline(deadlineInput);

      if (!deadlineValue) {
        res.status(400).json({
          message: "Format deadline harus YYYY-MM-DD dan tanggal harus valid",
        });
        return;
      }
    } else if (data.deadline) {
      res.status(400).json({
        message: "Materi tidak menggunakan deadline",
      });
      return;
    }

    const [classes]: any = await connection.execute(
      "SELECT id FROM kelas WHERE id = ?",
      [kelasId],
    );

    if (!classes.length) {
      res.status(400).json({ message: "Kelas tidak ditemukan" });
      return;
    }

    const gambar: string | null = req.file
      ? await uploadImage(req.file.buffer, "konten")
      : content.gambar;

    await connection.execute(
      `UPDATE tugas
       SET judul = ?, deskripsi = ?, jenis = ?, kelas_id = ?,
           deadline = ?, gambar = ?
       WHERE id = ? AND guru_id = ?`,
      [
        judul,
        deskripsi,
        jenis,
        kelasId,
        deadlineValue,
        gambar,
        id,
        req.user!.id,
      ],
    );

    res.json({
      message: "Konten berhasil diperbarui",
    });
  } catch (error) {
    console.error("Error updateKonten:", error);
    res.status(500).json({
      message: "Gagal memperbarui konten",
    });
  }
}

export async function deleteKonten(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: "ID tidak valid" });
      return;
    }

    const [rows]: any = await connection.execute(
      "SELECT id, guru_id FROM tugas WHERE id = ?",
      [id],
    );

    if (!rows.length) {
      res.status(404).json({ message: "Konten tidak ditemukan" });
      return;
    }

    if (req.user!.role !== "guru" || Number(rows[0].guru_id) !== req.user!.id) {
      res.status(403).json({
        message: "Hanya guru pemilik konten yang dapat menghapusnya",
      });
      return;
    }

    await connection.execute("DELETE FROM tugas WHERE id = ? AND guru_id = ?", [
      id,
      req.user!.id,
    ]);

    res.json({ message: "Konten berhasil dihapus" });
  } catch (error) {
    console.error("Error deleteKonten:", error);
    res.status(500).json({
      message:
        "Gagal menghapus konten; periksa apakah tugas sudah memiliki pengumpulan",
    });
  }
}
