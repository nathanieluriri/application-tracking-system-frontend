export type ApplicationStatus = "new" | "reviewing" | "shortlisted" | "interview" | "offered" | "accepted" | "rejected";

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  status: ApplicationStatus;
  appliedDate: string;
  experience: string;
  cvFileName: string;
  rating: number;
  notes: string;
  location: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: "acceptance" | "rejection" | "interview" | "custom";
}

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-info/10 text-info border-info/20" },
  reviewing: { label: "Reviewing", color: "bg-warning/10 text-warning border-warning/20" },
  shortlisted: { label: "Shortlisted", color: "bg-accent/10 text-accent border-accent/20" },
  interview: { label: "Interview", color: "bg-primary/10 text-primary border-primary/20" },
  offered: { label: "Offered", color: "bg-success/10 text-success border-success/20" },
  accepted: { label: "Accepted", color: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export const MOCK_APPLICANTS: Applicant[] = [
  { id: "1", name: "Adaeze Okonkwo", email: "adaeze@email.com", phone: "+234 801 234 5678", position: "Frontend Developer", status: "new", appliedDate: "2026-05-01", experience: "3 years", cvFileName: "adaeze_cv.pdf", rating: 4, notes: "", location: "Lagos" },
  { id: "2", name: "Chukwuma Eze", email: "chukwuma@email.com", phone: "+234 802 345 6789", position: "Backend Engineer", status: "reviewing", appliedDate: "2026-04-28", experience: "5 years", cvFileName: "chukwuma_cv.pdf", rating: 5, notes: "Strong Python skills", location: "Abuja" },
  { id: "3", name: "Fatima Bello", email: "fatima@email.com", phone: "+234 803 456 7890", position: "UI/UX Designer", status: "shortlisted", appliedDate: "2026-04-25", experience: "4 years", cvFileName: "fatima_cv.pdf", rating: 4, notes: "Great portfolio", location: "Kano" },
  { id: "4", name: "Oluwaseun Adeyemi", email: "seun@email.com", phone: "+234 804 567 8901", position: "Frontend Developer", status: "interview", appliedDate: "2026-04-22", experience: "2 years", cvFileName: "seun_cv.pdf", rating: 3, notes: "", location: "Lagos" },
  { id: "5", name: "Ngozi Umeh", email: "ngozi@email.com", phone: "+234 805 678 9012", position: "Project Manager", status: "offered", appliedDate: "2026-04-20", experience: "7 years", cvFileName: "ngozi_cv.pdf", rating: 5, notes: "Excellent leadership", location: "Port Harcourt" },
  { id: "6", name: "Ibrahim Musa", email: "ibrahim@email.com", phone: "+234 806 789 0123", position: "DevOps Engineer", status: "rejected", appliedDate: "2026-04-18", experience: "1 year", cvFileName: "ibrahim_cv.pdf", rating: 2, notes: "Needs more experience", location: "Kaduna" },
  { id: "7", name: "Blessing Nwosu", email: "blessing@email.com", phone: "+234 807 890 1234", position: "Data Analyst", status: "new", appliedDate: "2026-05-03", experience: "3 years", cvFileName: "blessing_cv.pdf", rating: 4, notes: "", location: "Enugu" },
  { id: "8", name: "Emeka Obi", email: "emeka@email.com", phone: "+234 808 901 2345", position: "Backend Engineer", status: "accepted", appliedDate: "2026-04-15", experience: "6 years", cvFileName: "emeka_cv.pdf", rating: 5, notes: "Offer accepted, starts June 1", location: "Lagos" },
  { id: "9", name: "Amina Yusuf", email: "amina@email.com", phone: "+234 809 012 3456", position: "Frontend Developer", status: "reviewing", appliedDate: "2026-05-02", experience: "2 years", cvFileName: "amina_cv.pdf", rating: 3, notes: "", location: "Jos" },
  { id: "10", name: "Tunde Bakare", email: "tunde@email.com", phone: "+234 810 123 4567", position: "UI/UX Designer", status: "new", appliedDate: "2026-05-04", experience: "5 years", cvFileName: "tunde_cv.pdf", rating: 4, notes: "Impressive Figma work", location: "Ibadan" },
];

export const MOCK_TEMPLATES: EmailTemplate[] = [
  { id: "1", name: "Acceptance Letter", subject: "Congratulations! You've been selected for {{position}}", body: "Dear {{name}},\n\nWe are thrilled to inform you that you have been selected for the {{position}} role at our company.\n\nWe were impressed by your qualifications and experience, and we believe you will be a great addition to our team.\n\nPlease expect a follow-up email with further details regarding your onboarding process.\n\nBest regards,\nHR Team", type: "acceptance" },
  { id: "2", name: "Rejection Letter", subject: "Update on your application for {{position}}", body: "Dear {{name}},\n\nThank you for your interest in the {{position}} position and for taking the time to apply.\n\nAfter careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.\n\nWe encourage you to apply for future openings that match your skills and experience.\n\nWishing you all the best,\nHR Team", type: "rejection" },
  { id: "3", name: "Interview Invite", subject: "Interview Invitation - {{position}}", body: "Dear {{name}},\n\nWe are pleased to invite you for an interview for the {{position}} position.\n\nPlease let us know your availability for the coming week so we can schedule a convenient time.\n\nLooking forward to meeting you.\n\nBest regards,\nHR Team", type: "interview" },
];

export const STATS = {
  totalApplications: 156,
  newThisWeek: 23,
  shortlisted: 34,
  interviewsScheduled: 12,
  offersExtended: 5,
  acceptanceRate: 78,
  avgTimeToHire: 18,
  openPositions: 8,
};

export const WEEKLY_APPLICATIONS = [
  { week: "W1 Apr", applications: 28, hires: 3 },
  { week: "W2 Apr", applications: 35, hires: 2 },
  { week: "W3 Apr", applications: 42, hires: 4 },
  { week: "W4 Apr", applications: 31, hires: 3 },
  { week: "W1 May", applications: 23, hires: 1 },
];

export const PIPELINE_DATA = [
  { stage: "New", count: 45 },
  { stage: "Reviewing", count: 32 },
  { stage: "Shortlisted", count: 34 },
  { stage: "Interview", count: 12 },
  { stage: "Offered", count: 5 },
  { stage: "Accepted", count: 8 },
];

export const POSITION_DATA = [
  { position: "Frontend Developer", count: 42 },
  { position: "Backend Engineer", count: 38 },
  { position: "UI/UX Designer", count: 28 },
  { position: "DevOps Engineer", count: 18 },
  { position: "Project Manager", count: 15 },
  { position: "Data Analyst", count: 15 },
];
