/**
 * ──────────────────────────────────────────────────────────────────────────
 *  THE JACARANDA APP — EDITABLE DISPLAY STRINGS
 * ──────────────────────────────────────────────────────────────────────────
 *
 * This is the single place to change the words players and Sensei see on the
 * main screens. You do NOT need to be a programmer to edit it — just change the
 * text between the quotes "like this" and leave everything else alone.
 *
 *  HOW TO EDIT (see docs/admin-guide.md §11 for the full walkthrough):
 *   1. Change only the text inside the quotes. Keep the quotes and the commas.
 *   2. Don't rename the labels on the left (e.g. `appName:`) — the app looks
 *      them up by those names.
 *   3. Apostrophes: write ’ inside the quotes, or use a plain ' — both work.
 *   4. Save, commit, and push. The site redeploys automatically (a few minutes).
 *
 *  WHAT THIS DOES NOT CONTROL:
 *   - Points / scoring values → edit the `point_rules` table (admin guide §4b).
 *   - Food / gym / meal lists → edit those catalogue tables (admin guide §4d/§4e).
 *   - Login error messages shown by the server → src/lib/auth/actions.ts.
 *
 * `as const` at the bottom keeps these values fixed and type-checked; don't
 * remove it.
 */

export const strings = {
  /** Club + app branding shown across the app. */
  brand: {
    /** Big title on the home and login screens. */
    appName: "The Jacaranda App",
    /** Tiny line under the title: the long form of the name. */
    expansion:
      "KMMGAFDRA · KFANDRA’s Monthly Multi-Game, Fitness & Diet Recording App",
    /** Small eyebrow label above the title on the home screen. */
    eyebrow: "KFANDRA",
    /** Club motto (tiny italic line). */
    motto: "Respect, Trust, Integrity, Passion & Humility",
    /** Footer line. */
    footer: "KFANDRA · Est. 2000 · Pune, India",
  },

  /** The three mode cards on the home screen. */
  home: {
    mmg: {
      title: "MMG",
      subtitle: "Tap entries · per session",
    },
    gym: {
      title: "Strength and Conditioning",
      subtitle: "Sets, reps & S&C tests",
    },
    diet: {
      title: "Diet",
      subtitle: "8 meals · tap foods to log",
    },
    balanceSheet: {
      title: "Club Balance Sheet",
      subtitle: "Bal. Sheet · Managers",
    },
  },

  /** Club Balance Sheet (KLCFERRSXVSG1) screens. */
  klc: {
    landingTitle: "KLCFERRSXVSG1",
    landingSubtitle: "Tap your club’s crest to open its balance sheet.",
    lockedNote: "Only your own club’s sheet is open to you.",
    noClubNote: "You don’t manage a club, so no sheet is editable.",
    sheetHeading: "Club Balance Sheet",
    managerLabel: "Player Manager",
    breadcrumb: "Balance Sheet",
    addLoanee: "+ Add loanee",
    pickPlayer: "Select player…",
    fields: {
      asOfDate: "Date",
      matchesPlayed: "Matches played",
      matchesWon: "Matches won",
      players: "Players (loanees)",
      matchesDrawn: "Matches drawn",
      matchesLost: "Matches lost",
      clubBonus: "Club Bonus from KFANDRA",
      paidToKfandra: "Total to be paid to KFANDRA",
      receivedFromKfandra: "Total to be received from KFANDRA",
      distributedToLoanees: "Total to be distributed to loanees",
    },
    currency: "Kroopies",
  },

  /** The sign-in / register screen. */
  login: {
    signInEyebrow: "Sign in",
    signInHeading: "Phone & 4-digit PIN",
    registerEyebrow: "Register",
    registerHeading: "Create your account",
    registerNote: "No approval needed — you’re in as soon as you register.",
    phoneLabel: "Phone number",
    phonePlaceholder: "98xxxxxxxx",
    pinLabel: "4-digit PIN",
    choosePinLabel: "Choose a 4-digit PIN",
    nameLabel: "Name (player nickname)",
    namePlaceholder: "Your nickname",
    signInButton: "Sign in",
    createAccountButton: "Create account",
    /** Link under the sign-in form. */
    firstTimeLink: "First time? Create an account",
    /** Prominent nudge shown after a failed sign-in. */
    failedSignInNudge: "New here? Create an account →",
    backToSignIn: "← Back to sign-in",
    otpNote: "SMS OTP coming in V2",
    pleaseWait: "Please wait…",
  },

  /** Admin section chrome (staff-only screens). */
  admin: {
    title: "Admin",
    subtitle: "KFANDRA staff only",
    mmgCard: { title: "MMG", subtitle: "Submissions by date or player" },
    gymCard: { title: "Strength & Conditioning", subtitle: "Review daily logs" },
    dietCard: { title: "Diet", subtitle: "Review daily logs" },
    klcCard: { title: "Club Balance Sheet", subtitle: "Review each club’s sheet" },
    configCard: { title: "Scoring", subtitle: "Edit points & game names" },
    backToApp: "← Back to app",
    home: "Admin",
  },
} as const;

export type AppStrings = typeof strings;
