import { Router } from "express";
import { auth, allowRoles } from "../middleware/auth";
import {
  getKelas,
  getKelasById,
  createKelas,
  updateKelas,
  deleteKelas,
} from "../controller/kelasController";

const router = Router();

router.use(auth, allowRoles("admin"));

router.get("/", getKelas);
router.get("/:id", getKelasById);
router.post("/", createKelas);
router.patch("/:id", updateKelas);
router.delete("/:id", deleteKelas);

export default router;
