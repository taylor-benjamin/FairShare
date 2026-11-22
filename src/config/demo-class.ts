// Demo mode's shared settings and placeholder class. All names here are made up.
// The real class list is never committed: it comes from the DEMO_ROSTER secret on the demo site.

export const DEMO_PASSWORD = "FairShare2026!";
export const DEMO_DOMAIN = "fairshare.demo";
export const DEMO_LOGINS = {
  instructor: `professor@${DEMO_DOMAIN}`,
  student: `student@${DEMO_DOMAIN}`,
} as const;

/** How long a visitor's private copy is kept, and how many copies can exist at once. */
export const DEMO_LIMITS = { WORKSPACE_HOURS: 24, MAX_WORKSPACES: 300 } as const;

export type DemoRole = "Scrum Master" | "Product Owner" | "Developer";
export interface DemoMember {
  first: string;
  last: string;
  role: DemoRole;
}
export interface DemoTeam {
  name: string;
  status: "published" | "finished";
  members: DemoMember[];
}
export interface DemoRoster {
  course: { code: string; name: string; section: string; project: string };
  professor: { first: string; last: string };
  teams: DemoTeam[];
  scenarios: {
    /** The five-person team that shows the review features. */
    reviewTeam: string;
    /** The one student shown as inactive, disputed and flagged. Not the Product Owner. */
    reviewMember: string;
    /** Who the student login opens as, on the review team. Not the Product Owner. */
    defaultStudent: string;
    /** The team whose charter is still waiting on two Developers. */
    charterTeam: string;
    /** The team with a pending invite. */
    inviteTeam: string;
  };
}

const sm = (first: string, last: string): DemoMember => ({ first, last, role: "Scrum Master" });
const po = (first: string, last: string): DemoMember => ({ first, last, role: "Product Owner" });
const dev = (first: string, last: string): DemoMember => ({ first, last, role: "Developer" });

export const DEMO_PLACEHOLDER_ROSTER: DemoRoster = {
  course: { code: "DEMO 101", name: "Sample Course", section: "1", project: "Sample Project" },
  professor: { first: "Pat", last: "Example" },
  teams: [
    { name: "Team Red", status: "published", members: [po("Avery", "Sample"), dev("Blair", "Sample"), sm("Casey", "Sample"), dev("Drew", "Sample")] },
    { name: "Team Blue", status: "published", members: [sm("Emery", "Sample"), dev("Finley", "Sample"), dev("Gray", "Sample"), po("Harper", "Sample")] },
    { name: "Team Green", status: "published", members: [dev("Indigo", "Sample"), sm("Jules", "Sample"), po("Kai", "Sample"), dev("Lane", "Sample"), dev("Morgan", "Sample")] },
    { name: "Team Gold", status: "finished", members: [dev("Noel", "Sample"), dev("Oakley", "Sample"), sm("Parker", "Sample"), po("Quinn", "Sample")] },
  ],
  scenarios: {
    reviewTeam: "Team Green",
    reviewMember: "Jules Sample",
    defaultStudent: "Lane Sample",
    charterTeam: "Team Red",
    inviteTeam: "Team Blue",
  },
};
