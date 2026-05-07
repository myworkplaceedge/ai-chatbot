import { Router } from "express";
import { prisma } from "../lib/db";

export const ratingRouter = Router();

ratingRouter.post("/", async (req, res) => {
  try {
    const body = req.body as { messageId?: string; value?: string };
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const value = typeof body.value === "string" ? body.value.trim() : "";

    if (!messageId || !value) {
      res.status(400).json({ error: "messageId and value are required" });
      return;
    }

    if (value !== "thumbs_up" && value !== "thumbs_down") {
      res.status(400).json({ error: "value must be 'thumbs_up' or 'thumbs_down'" });
      return;
    }

    // Verify the message exists
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    // Upsert: one rating per message
    const existing = await prisma.rating.findFirst({ where: { messageId } });
    if (existing) {
      const updated = await prisma.rating.update({
        where: { id: existing.id },
        data: { value },
      });
      res.json(updated);
      return;
    }

    const rating = await prisma.rating.create({
      data: { messageId, value },
    });
    res.json(rating);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rating failed";
    res.status(500).json({ error: msg });
  }
});
