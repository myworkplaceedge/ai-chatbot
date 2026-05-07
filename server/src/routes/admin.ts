import { Router } from "express";

export const adminRouter = Router();

adminRouter.get("/session", (_req, res) => {
  res.json({ authenticated: true });
});
