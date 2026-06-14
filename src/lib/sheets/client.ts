import "server-only";
import { google } from "googleapis";

/**
 * Thin Sheets wrapper behind an interface so the export orchestration can be
 * tested with an in-memory fake (no live API calls in CI).
 */
export interface SheetsClient {
  /** Ensure a tab with `title` exists; create it if missing. */
  ensureTab(spreadsheetId: string, title: string): Promise<void>;
  /** Replace a tab's contents (from A1) with the given matrix. */
  writeMatrix(
    spreadsheetId: string,
    title: string,
    matrix: (string | number)[][],
  ): Promise<void>;
}

function getAuth() {
  const b64 = process.env.GOOGLE_SHEETS_SA_KEY;
  if (!b64) throw new Error("GOOGLE_SHEETS_SA_KEY is not set.");
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function createSheetsClient(): SheetsClient {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  return {
    async ensureTab(spreadsheetId, title) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const exists = (meta.data.sheets ?? []).some(
        (s) => s.properties?.title === title,
      );
      if (!exists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title } } }] },
        });
      }
    },
    async writeMatrix(spreadsheetId, title, matrix) {
      // Clear first so removed players/sessions don't linger from a prior write.
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: title });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: matrix },
      });
    },
  };
}
