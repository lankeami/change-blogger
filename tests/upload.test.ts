import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

describe("uploadReport", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when GOOGLE_DRIVE_CREDENTIALS_PATH is missing", async () => {
    delete process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
    process.env.GOOGLE_DRIVE_FOLDER_ID = "test-folder";

    const { uploadReport } = await import("../src/upload.js");
    await expect(
      uploadReport({ reportPath: "/tmp/fake.html" })
    ).rejects.toThrow("GOOGLE_DRIVE_CREDENTIALS_PATH");
  });

  it("throws when GOOGLE_DRIVE_FOLDER_ID is missing", async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS_PATH = "/tmp/fake-creds.json";
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;

    const { uploadReport } = await import("../src/upload.js");
    await expect(
      uploadReport({ reportPath: "/tmp/fake.html" })
    ).rejects.toThrow("GOOGLE_DRIVE_FOLDER_ID");
  });

  it("throws when report file does not exist", async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS_PATH = "/tmp/fake-creds.json";
    process.env.GOOGLE_DRIVE_FOLDER_ID = "test-folder";

    const { uploadReport } = await import("../src/upload.js");
    await expect(
      uploadReport({ reportPath: "/tmp/nonexistent-report.html" })
    ).rejects.toThrow("site/report.html");
  });
});
