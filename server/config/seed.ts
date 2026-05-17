import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_RMU_GROUP_PREFIXES } from "./utils/defaultGroupPrefixes";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
  };

  // Seed default TenantSettings
  console.log("⚙️  Creating default tenant settings...");
  await prisma.tenantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      organizationName: "Submitter Grievance Portal",
      primaryColor: "#2563eb",
      accentColor: "#1e40af",
      rolesConfig: [
        { key: "student", label: "Student", level: 0, isSubmitter: true, groupScoped: true },
        { key: "advisor", label: "Advisor", level: 1, isSubmitter: false, groupScoped: true },
        { key: "hod", label: "Head of Group", level: 2, isSubmitter: false, groupScoped: true },
        { key: "registrar", label: "Registrar", level: 3, isSubmitter: false, groupScoped: false },
      ],
      escalationConfig: [
        { fromStatus: "submitted", toStatuses: ["under_review", "rejected"] },
        { fromStatus: "under_review", toStatuses: ["forwarded_to_hod", "resolved", "rejected"] },
        { fromStatus: "forwarded_to_hod", toStatuses: ["forwarded_to_registrar", "resolved", "rejected"] },
        { fromStatus: "forwarded_to_registrar", toStatuses: ["resolved", "rejected"] },
        { fromStatus: "resolved", toStatuses: [] },
        { fromStatus: "rejected", toStatuses: [] },
      ],
      ticketTypesConfig: [
        { key: "academic_issue", label: "Academic Issue" },
        { key: "administrative_issue", label: "Administrative Issue" },
        { key: "facility_issue", label: "Facility Issue" },
        { key: "disciplinary_issue", label: "Disciplinary Issue" },
        { key: "financial_issue", label: "Financial Issue" },
        { key: "other", label: "Other" },
      ],
      statusLabelsConfig: [
        { key: "submitted", label: "Submitted", color: "#f59e0b" },
        { key: "under_review", label: "Under Review", color: "#3b82f6" },
        { key: "forwarded_to_hod", label: "Forwarded to HOD", color: "#8b5cf6" },
        { key: "forwarded_to_registrar", label: "Forwarded to Registrar", color: "#6366f1" },
        { key: "resolved", label: "Resolved", color: "#22c55e" },
        { key: "rejected", label: "Rejected", color: "#ef4444" },
      ],
      allowedEmailDomains: ["st.rmu.edu.gh", "rmu.edu.gh"],
      groupPrefixes: DEFAULT_RMU_GROUP_PREFIXES,
    },
  });
  console.log("✅ Default tenant settings created");

  // Submitters
  console.log("👨‍🎓 Creating submitters...");
  const submitterData = [
    {
      name: "Elton Morden",
      email: "elton.morden@st.rmu.edu.gh",
      password: "Morden@123",
      role: "student",
      submitterId: "BIT0001526",
      group: "Information Technology",
    }
  ];

  for (const submitter of submitterData) {
    const passwordHash = await hashPassword(submitter.password);
    await prisma.user.upsert({
      where: { email: submitter.email },
      update: {},
      create: {
        name: submitter.name,
        email: submitter.email,
        passwordHash,
        role: submitter.role,
        submitterId: submitter.submitterId,
        group: submitter.group,
        emailVerified: true,
      },
    });
    console.log(`✅ Created submitter: ${submitter.name} (${submitter.submitterId})`);
  }

  // Class Advisors
  console.log("👨‍🏫 Creating class advisors...");
  const advisorData = [
    {
      name: "Dr. Jane Smith",
      email: "eltonmorden029@gmail.com",
      password: "Advisor@123",
      role: "advisor",
      group: "Information Technology",
    }
  ];

  for (const advisor of advisorData) {
    const passwordHash = await hashPassword(advisor.password);
    await prisma.user.upsert({
      where: { email: advisor.email },
      update: {},
      create: {
        name: advisor.name,
        email: advisor.email,
        passwordHash,
        role: advisor.role,
        group: advisor.group,
        emailVerified: true,
      },
    });
    console.log(`✅ Created class advisor: ${advisor.name} (${advisor.group})`);
  }

  // Head of Groups
  console.log("👔 Creating Heads of Group...");
  const hodData = [
    {
      name: "Prof. Robert Johnson",
      email: "eltonmorden@icloud.com",
      password: "HOD@123",
      role: "hod",
      group: "Information Technology",
    },
  ];

  for (const hod of hodData) {
    const passwordHash = await hashPassword(hod.password);
    await prisma.user.upsert({
      where: { email: hod.email },
      update: {},
      create: {
        name: hod.name,
        email: hod.email,
        passwordHash,
        role: hod.role,
        group: hod.group,
        emailVerified: true,
      },
    });
    console.log(`✅ Created HOD: ${hod.name} (${hod.group})`);
  }

  // Registrar (created by seed/admin, not public registration)
  console.log("🏛️ Creating registrar...");
  const registrarData = [
    {
      name: "Registrar Office",
      email: "registrar@rmu.edu.gh",
      password: "Registrar@123",
      role: "registrar",
      group: null,
    },
  ];

  for (const registrar of registrarData) {
    const passwordHash = await hashPassword(registrar.password);
    await prisma.user.upsert({
      where: { email: registrar.email },
      update: {},
      create: {
        name: registrar.name,
        email: registrar.email,
        passwordHash,
        role: registrar.role,
        group: registrar.group,
        emailVerified: true,
      },
    });
    console.log(`✅ Created registrar: ${registrar.name}`);
  }

  console.log("\n✨ Seed completed successfully!");
  console.log("\n📝 Login Credentials Summary:");
  console.log("\n👨‍🎓 Submitters:");
  console.log("  - Email: elton.morden@st.rmu.edu.gh | Password: Morden@123");
  console.log("\n👨‍🏫 Class Advisors:");
  console.log("  - Email: eltonmorden029@gmail.com | Password: Advisor@123");
  console.log("\n👔 HODs:");
  console.log("  - Email: eltonmorden@icloud.com | Password: HOD@123");
  console.log("\n🏛️ Registrar:");
  console.log("  - Email: registrar@rmu.edu.gh | Password: Registrar@123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
