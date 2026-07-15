declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: R2Bucket;
    IMAGES: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: {
            format: string;
            quality: number;
          }): Promise<{ response(): Response }>;
        };
      };
    };
  }
}
