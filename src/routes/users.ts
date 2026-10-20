import { Router } from "express";
import { auth, allowRoles } from "../middleware/auth";
import upload from "../middleware/upload";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controller/userController";

const router = Router();

router.get("/", auth, allowRoles("admin"), getUsers);
router.get("/:id", auth, allowRoles("admin"), getUserById);
router.post("/", auth, allowRoles("admin"), upload.single("foto"), createUser);
router.patch(
  "/:id",
  auth,
  allowRoles("admin"),
  upload.single("foto"),
  updateUser,
);
router.delete("/:id", auth, allowRoles("admin"), deleteUser);

export default router;
