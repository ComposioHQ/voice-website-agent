import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/core";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

export const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new OpenAIProvider(),
});

let toolsRegistered = false;

export async function ensureToolsRegistered() {
  if (toolsRegistered) return;

  composio.tools.createCustomTool({
    slug: "WRITE_FULL_HTML_PREVIEW",
    name: "Write Full HTML Preview",
    description:
      "Writes a complete HTML document to public/preview.html so the preview updates.",
    inputParams: z
      .object({
        html: z
          .string()
          .min(1, "Provide a complete HTML document")
          .describe(
            "Full HTML document (must include <!doctype html> or <html>)"
          )
          .refine(
            (val) =>
              /<!doctype\s+html/i.test(val) || /<html[\s>]/i.test(val),
            "Input must be a full HTML document (include <!doctype html> or <html>)"
          ),
      })
      .strict(),
    execute: async (input: { html: string }) => {
      const { html } = input;
      try {
        await fs.writeFile(
          path.join(process.cwd(), "public", "preview.html"),
          html,
          "utf8"
        );
        return {
          data: {
            path: "preview.html",
            url: "/preview.html",
            bytesWritten: Buffer.byteLength(html, "utf8"),
          },
          error: null,
          successful: true,
        };
      } catch (err: any) {
        const message = `Failed to write ${path.join(
          process.cwd(),
          "public",
          "preview.html"
        )}: ${err?.message || String(err)}`;
        return {
          data: {
            path: "preview.html",
            url: "/preview.html",
            errorMessage: message,
          },
          error: message,
          successful: false,
        };
      }
    },
  });

  toolsRegistered = true;
}


