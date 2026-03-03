import { createRegistrationSchema } from "./server/config/validation/registrationSchema";

const schema = createRegistrationSchema({
  allowedEmailDomains: [],
  roles: ["submitter", "class_advisor", "hod", "registrar"],
  groupPrefixes: {},
  submitterRoleKey: "submitter"
});

const payload = {
  name: "Test User",
  email: "test@st.rmu.edu.gh",
  password: "password123",
  role: "submitter",
  submitterId: "BIT0001526",
  group: "ICT"
};

const result = schema.safeParse(payload);
console.log(JSON.stringify(result, null, 2));
