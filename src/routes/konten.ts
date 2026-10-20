import { Router } from "express";
import { auth, allowRoles } from "../middleware/auth";
import upload from "../middleware/upload";
import {
  getKonten,
  createKonten,
  updateKonten,
  deleteKonten,
} from "../controller/kontenController";

const router = Router();

router.get("/", auth, getKonten);
router.post(
  "/",
  auth,
  allowRoles("guru"),
  upload.single("gambar"),
  createKonten,
);
router.patch(
  "/:id",
  auth,
  allowRoles("guru"),
  upload.single("gambar"),
  updateKonten,
);
router.delete("/:id", auth, allowRoles("guru"), deleteKonten);

export default router;
