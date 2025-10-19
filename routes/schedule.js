import express from "express";
import { PrismaClient } from "@prisma/client";
import { getBarangayFilter, canModifyRecord } from "../middleware/baranggayAccess.js";

const router = express.Router();
const prisma = new PrismaClient();

// GET events with role-based filtering
router.get("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const { barangay, center_type, start, end } = req.query;

    const where = {};

    // Role-based barangay filter
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF')) {
      if (user?.assigned_barangay) {
        where.barangay = user.assigned_barangay;
      }
    }

    // Optional explicit filters (admins may pass barangay)
    if (barangay) where.barangay = barangay;
    if (center_type) where.center_type = center_type;
    if (start || end) {
      where.AND = [];
      if (start) where.AND.push({ end_time: { gte: new Date(start) } });
      if (end) where.AND.push({ start_time: { lte: new Date(end) } });
    }

    const events = await prisma.calendar_events.findMany({
      where,
      orderBy: { start_time: 'asc' }
    });

    res.json({ success: true, data: events });
  } catch (err) {
    console.error('Get schedule error:', err);
    next(err);
  }
});

// POST create event
router.post("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const data = req.body;

    // Non-admins are restricted to their barangay
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      data.barangay = user.assigned_barangay;
      data.center_type = 'BARANGAY';
    }

    const event = await prisma.calendar_events.create({
      data: {
        title: data.title,
        description: data.description,
        start_time: new Date(data.start_time),
        end_time: new Date(data.end_time),
        all_day: !!data.all_day,
        center_type: data.center_type,
        barangay: data.barangay,
        location: data.location,
        color: data.color,
        created_by_id: user?.user_id || null
      }
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    console.error('Create schedule error:', err);
    next(err);
  }
});

// PUT update event
router.put("/:id", async (req, res, next) => {
  try {
    const user = req.user || null;
    const eventId = Number(req.params.id);

    const existing = await prisma.calendar_events.findUnique({ where: { event_id: eventId } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF' && user.assigned_barangay !== existing.barangay) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data = req.body;
    const updated = await prisma.calendar_events.update({
      where: { event_id: eventId },
      data: {
        title: data.title,
        description: data.description,
        start_time: data.start_time ? new Date(data.start_time) : undefined,
        end_time: data.end_time ? new Date(data.end_time) : undefined,
        all_day: data.all_day,
        center_type: data.center_type,
        barangay: data.barangay,
        location: data.location,
        color: data.color,
        updated_at: new Date()
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update schedule error:', err);
    next(err);
  }
});

// DELETE event
router.delete("/:id", async (req, res, next) => {
  try {
    const user = req.user || null;
    const eventId = Number(req.params.id);
    const existing = await prisma.calendar_events.findUnique({ where: { event_id: eventId } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF' && user.assigned_barangay !== existing.barangay) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.calendar_events.delete({ where: { event_id: eventId } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete schedule error:', err);
    next(err);
  }
});

export default router;



