import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Hash password function
  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
  };

  // Clear existing data (optional - comment out if you want to keep existing data)

  // // Students
  console.log("👨‍🎓 Creating students...");
  const studentData = [
    {
      name: "Elton Morden",
      email: "elton.morden@st.rmu.edu.gh",
      password: "Morden@123",
      role: "student" as const,
      studentId: "BIT0001526",
      department: "ICT",
    }
  ];

  for (const student of studentData) {
    const passwordHash = await hashPassword(student.password);
    await prisma.user.create({
      data: {
        name: student.name,
        email: student.email,
        passwordHash,
        role: student.role,
        studentId: student.studentId,
        department: student.department,
      },
    });
    console.log(`✅ Created student: ${student.name} (${student.studentId})`);
  }

  // Class Advisors
  console.log("👨‍🏫 Creating class advisors...");
  const advisorData = [
    {
      name: "Dr. Jane Smith",
      email: "eltonmorden029@gmail.com",
      password: "Advisor@123",
      role: "class_advisor" as const,
      department: "ICT",
    }
  ];

  for (const advisor of advisorData) {
    const passwordHash = await hashPassword(advisor.password);
    await prisma.user.create({
      data: {
        name: advisor.name,
        email: advisor.email,
        passwordHash,
        role: advisor.role,
        department: advisor.department,
      },
    });
    console.log(`✅ Created class advisor: ${advisor.name} (${advisor.department})`);
  }

  // Head of Departments (HOD)
  console.log("👔 Creating Heads of Department...");
  const hodData = [
    {
      name: "Prof. Robert Johnson",
      email: "eltonmorden@icloud.com",
      password: "HOD@123",
      role: "hod" as const,
      department: "ICT",
    },
  ];

  for (const hod of hodData) {
    const passwordHash = await hashPassword(hod.password);
    await prisma.user.create({
      data: {
        name: hod.name,
        email: hod.email,
        passwordHash,
        role: hod.role,
        department: hod.department,
      },
    });
    console.log(`✅ Created HOD: ${hod.name} (${hod.department})`);
  }

  // Registrars
  // console.log("📋 Creating registrars...");
  // const registrarData = [
  //   {
  //     name: "Ms. Sarah Wilson",
  //     email: "eltonjohnmorden@gmail.com",
  //     password: "Registrar@123",
  //     role: "registrar" as const,
  //     department: null,
  //   }
  // ];

  // for (const registrar of registrarData) {
  //   const passwordHash = await hashPassword(registrar.password);
  //   await prisma.user.create({
  //     data: {
  //       name: registrar.name,
  //       email: registrar.email,
  //       passwordHash,
  //       role: registrar.role,
  //       department: registrar.department,
  //     },
  //   });
  //   console.log(`✅ Created registrar: ${registrar.name}`);
  // }

  console.log("\n✨ Seed completed successfully!");
  console.log("\n📝 Login Credentials Summary:");
  console.log("\n👨‍🎓 Students:");
  console.log("  - Email: elton.morden@st.rmu.edu.gh | Password: Morden@123");
  console.log("  - Email: sarah.mensah@st.rmu.edu.gh | Password: Mensah@123");
  console.log("\n👨‍🏫 Class Advisors:");
  console.log("  - Email: jane.smith@rmu.edu.gh | Password: Advisor@123");
  console.log("  - Email: michael.ofori@rmu.edu.gh | Password: Advisor@123");
  console.log("\n👔 HODs:");
  console.log("  - Email: robert.johnson@rmu.edu.gh | Password: HOD@123");
  console.log("  - Email: elizabeth.adjei@rmu.edu.gh | Password: HOD@123");
  console.log("\n📋 Registrars:");
  console.log("  - Email: sarah.wilson@rmu.edu.gh | Password: Registrar@123");
  console.log("  - Email: david.amoah@rmu.edu.gh | Password: Registrar@123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

