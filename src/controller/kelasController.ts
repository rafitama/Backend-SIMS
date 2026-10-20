import { Request, Response } from 'express';
import { z } from 'zod';
import  connection  from '../db';

const kelasSchema = z.object({
  nama_kelas: z.string().trim().min(1, 'Nama kelas wajib diisi'),
  wali_kelas_id: z.number().int().positive().nullable().optional(),
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan pada server';
}

export async function getKelas(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [rows] = await connection.query(
      `SELECT
        k.id,
        k.nama_kelas,
        k.wali_kelas_id,
        u.nama AS nama_wali_kelas
       FROM kelas k
       LEFT JOIN users u ON u.id = k.wali_kelas_id
       ORDER BY k.id DESC`,
    );

    res.json({
      message: 'Data kelas berhasil diambil',
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      message: getErrorMessage(error),
    });
  }
}

export async function getKelasById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'ID kelas tidak valid' });
      return;
    }

    const [rows] = await connection.query(
      `SELECT
        k.id,
        k.nama_kelas,
        k.wali_kelas_id,
        u.nama AS nama_wali_kelas
       FROM kelas k
       LEFT JOIN users u ON u.id = k.wali_kelas_id
       WHERE k.id = ?`,
      [id],
    );

    const kelas = (rows as any[])[0];

    if (!kelas) {
      res.status(404).json({ message: 'Kelas tidak ditemukan' });
      return;
    }

    res.json({
      message: 'Data kelas berhasil diambil',
      data: kelas,
    });
  } catch (error) {
    res.status(500).json({
      message: getErrorMessage(error),
    });
  }
}

export async function createKelas(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = kelasSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: parsed.error.issues[0]?.message ?? 'Data tidak valid',
      });
      return;
    }

    const namaKelas = parsed.data.nama_kelas.trim().toUpperCase();
    const waliKelasId = parsed.data.wali_kelas_id ?? null;

    if (waliKelasId !== null) {
      const [waliRows] = await connection.query(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [waliKelasId, 'guru'],
      );

      if ((waliRows as any[]).length === 0) {
        res.status(400).json({
          message: 'Wali kelas harus menggunakan akun guru yang valid',
        });
        return;
      }
    }

    const [result] = await connection.query(
      'INSERT INTO kelas (nama_kelas, wali_kelas_id) VALUES (?, ?)',
      [namaKelas, waliKelasId],
    );

    res.status(201).json({
      message: 'Kelas berhasil ditambahkan',
      data: {
        id: (result as any).insertId,
        nama_kelas: namaKelas,
        wali_kelas_id: waliKelasId,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes('Duplicate entry')) {
      res.status(409).json({
        message: 'Nama kelas tersebut sudah digunakan',
      });
      return;
    }

    res.status(500).json({ message });
  }
}

export async function updateKelas(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'ID kelas tidak valid' });
      return;
    }

    const parsed = kelasSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: parsed.error.issues[0]?.message ?? 'Data tidak valid',
      });
      return;
    }

    const [existingRows] = await connection.query(
      'SELECT id FROM kelas WHERE id = ?',
      [id],
    );

    if ((existingRows as any[]).length === 0) {
      res.status(404).json({ message: 'Kelas tidak ditemukan' });
      return;
    }

    const namaKelas = parsed.data.nama_kelas.trim().toUpperCase();
    const waliKelasId = parsed.data.wali_kelas_id ?? null;

    if (waliKelasId !== null) {
      const [waliRows] = await connection.query(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [waliKelasId, 'guru'],
      );

      if ((waliRows as any[]).length === 0) {
        res.status(400).json({
          message: 'Wali kelas harus menggunakan akun guru yang valid',
        });
        return;
      }
    }

    await connection.query(
      `UPDATE kelas
       SET nama_kelas = ?, wali_kelas_id = ?
       WHERE id = ?`,
      [namaKelas, waliKelasId, id],
    );

    res.json({
      message: 'Kelas berhasil diperbarui',
      data: {
        id,
        nama_kelas: namaKelas,
        wali_kelas_id: waliKelasId,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes('Duplicate entry')) {
      res.status(409).json({
        message: 'Nama kelas tersebut sudah digunakan',
      });
      return;
    }

    res.status(500).json({ message });
  }
}

export async function deleteKelas(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'ID kelas tidak valid' });
      return;
    }

    const [existingRows] = await connection.query(
      'SELECT id FROM kelas WHERE id = ?',
      [id],
    );

    if ((existingRows as any[]).length === 0) {
      res.status(404).json({ message: 'Kelas tidak ditemukan' });
      return;
    }

    const [studentRows] = await connection.query(
      'SELECT id FROM users WHERE kelas_id = ? LIMIT 1',
      [id],
    );

    if ((studentRows as any[]).length > 0) {
      res.status(409).json({
        message: 'Kelas tidak bisa dihapus karena masih memiliki siswa',
      });
      return;
    }

    const [taskRows] = await connection.query(
      'SELECT id FROM tugas WHERE kelas_id = ? LIMIT 1',
      [id],
    );

    if ((taskRows as any[]).length > 0) {
      res.status(409).json({
        message: 'Kelas tidak bisa dihapus karena masih memiliki materi atau tugas',
      });
      return;
    }

    await connection.query('DELETE FROM kelas WHERE id = ?', [id]);

    res.json({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({
      message: getErrorMessage(error),
    });
  }
}
