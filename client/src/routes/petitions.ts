// import { Router } from "express";
// import prisma from "../prismaClient";
// import jwt from "jsonwebtoken";

// const router = Router();

// // Middleware to protect routes
// function authMiddleware(req: any, res: any, next: any) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) return res.status(401).json({ error: "No token provided" });

//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET!);
//     req.user = decoded;
//     next();
//   } catch {
//     res.status(401).json({ error: "Invalid token" });
//   }
// }

// // Create petition
// router.post("/", authMiddleware, async (req: any, res) => {
//   const { title, content } = req.body;
//   const petition = await prisma.petition.create({
//     data: {
//       title,
//       content,
//       userId: req.user.userId,
//     },
//   });
//   res.json(petition);
// });

// // Get petitions
// router.get("/", async (req, res) => {
//   const petitions = await prisma.petition.findMany({
//     include: { user: true },
//   });
//   res.json(petitions);
// });

// export default router;
