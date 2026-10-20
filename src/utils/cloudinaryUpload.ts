import { Readable } from "stream";
import cloudinary from "../cloudinary";

export function uploadImage(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `sims/${folder}`, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Upload gambar gagal"));
        resolve(result.secure_url);
      },
    );

    Readable.from(buffer).pipe(stream);
  });
}
