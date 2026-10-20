import { Router } from "express";
import { auth } from "../middleware/auth";
import upload from "../middleware/upload";
import { getProfile, updateProfile } from "../controller/profileController";

const router = Router();

router.get("/", auth, getProfile);
router.patch("/", auth, upload.single("foto"), updateProfile);

export default router;
