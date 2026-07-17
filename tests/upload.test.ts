import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { uploadReport } from "../src/upload.js";

describe("uploadReport", () => {
  const originalEnv = process.env;
  const fakeCreds = "/tmp/fake-creds.json";

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when GOOGLE_DRIVE_CREDENTIALS_PATH is missing", async () => {
    delete process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
    process.env.GOOGLE_DRIVE_FOLDER_ID = "test-folder";

    await expect(
      uploadReport({ reportPath: "/tmp/fake.html" })
    ).rejects.toThrow("GOOGLE_DRIVE_CREDENTIALS_PATH");
  });

  it("throws when GOOGLE_DRIVE_FOLDER_ID is missing", async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS_PATH = fakeCreds;
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;

    await expect(
      uploadReport({ reportPath: "/tmp/fake.html" })
    ).rejects.toThrow("GOOGLE_DRIVE_FOLDER_ID");
  });

  it("throws when report file does not exist", async () => {
    writeFileSync(fakeCreds, "{}");
    try {
      process.env.GOOGLE_DRIVE_CREDENTIALS_PATH = fakeCreds;
      process.env.GOOGLE_DRIVE_FOLDER_ID = "test-folder";

      await expect(
        uploadReport({ reportPath: "/tmp/nonexistent-report.html" })
      ).rejects.toThrow("site/report.html");
    } finally {
      if (existsSync(fakeCreds)) unlinkSync(fakeCreds);
    }
  });
});
