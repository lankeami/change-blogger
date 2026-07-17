import { existsSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { resolve } from "node:path";

export interface UploadOptions {
  reportPath: string;
}

export async function uploadReport(opts: UploadOptions): Promise<string> {
  const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
  if (!credentialsPath) {
    throw new Error(
      "Missing env var GOOGLE_DRIVE_CREDENTIALS_PATH — set it to the path of your service account JSON key"
    );
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      "Missing env var GOOGLE_DRIVE_FOLDER_ID — set it to the target Google Drive folder ID"
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    throw new Error(`GOOGLE_DRIVE_FOLDER_ID contains unexpected characters: ${folderId}`);
  }

  if (!existsSync(credentialsPath)) {
    throw new Error(
      `Credentials file not found at ${credentialsPath} — check GOOGLE_DRIVE_CREDENTIALS_PATH`
    );
  }

  if (!existsSync(opts.reportPath)) {
    throw new Error(
      `Report not found at ${opts.reportPath} — run 'make report' first to generate site/report.html`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });
  const fileName = "index.html";

  const existing = await drive.files.list({
    q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id, webViewLink)",
    spaces: "drive",
  });

  const media = {
    mimeType: "text/html",
    body: createReadStream(opts.reportPath),
  };

  let fileId: string;
  let webViewLink: string;

  if (existing.data.files && existing.data.files.length > 0) {
    const existingId = existing.data.files[0].id;
    if (!existingId) throw new Error("Drive API returned a file with no id");
    fileId = existingId;
    const updated = await drive.files.update({
      fileId,
      media,
      fields: "id, webViewLink",
    });
    const updatedLink = updated.data.webViewLink;
    if (!updatedLink) throw new Error("Drive API returned an updated file with no webViewLink");
    webViewLink = updatedLink;
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: "text/html",
      },
      media,
      fields: "id, webViewLink",
    });
    const createdId = created.data.id;
    if (!createdId) throw new Error("Drive API returned a created file with no id");
    fileId = createdId;
    const createdLink = created.data.webViewLink;
    if (!createdLink) throw new Error("Drive API returned a created file with no webViewLink");
    webViewLink = createdLink;
  }

  return webViewLink;
}

async function main(): Promise<void> {
  const reportPath = resolve(process.cwd(), "site", "report.html");

  const link = await uploadReport({ reportPath });
  console.log(`Uploaded to Google Drive: ${link}`);
}

// Only run as CLI entry point, not when imported as a module
const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
