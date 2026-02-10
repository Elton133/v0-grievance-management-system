import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db";
import { registrationSchema } from "../validation/registrationSchema";

export const registerUser = async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const validationResult = registrationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({ 
        msg: "Validation failed", 
        errors 
      });
    }

    const { name, email, password, role, studentId, department } = validationResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        passwordHash: hashedPassword,
        role,
        studentId,
        department
      },
    });

    res.status(201).json({ msg: "User registered", user });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ msg: "Server error", err });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ msg: "Server error", err });
  }
};
