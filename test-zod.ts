import { createRegistrationSchema } from "./server/config/validation/registrationSchema";

const schema = createRegistrationSchema({
  allowedEmailDomains: [],
  roles: ["student", "advisor", "hod", "registrar"],
  groupPrefixes: {},
  submitterRoleKey: "student"
});

const payload = {
  name: "Test User",
  email: "test@st.rmu.edu.gh",
  password: "Password1!",
  role: "student",
  submitterId: "BIT0001526",
  group: "ICT"
};

const result = schema.safeParse(payload);
console.log(JSON.stringify(result, null, 2));
