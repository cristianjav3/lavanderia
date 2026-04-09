import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}

interface Html2PdfOptions {
  margin?: number | number[];
  filename?: string;
  image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
  html2canvas?: Record<string, unknown>;
  jsPDF?: { unit?: string; format?: string | [number, number]; orientation?: "portrait" | "landscape"; [key: string]: unknown };
  [key: string]: unknown;
}

declare module "html2pdf.js" {
  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement): Html2PdfWorker;
    save(): Promise<void>;
    outputPdf(type: "blob"): Promise<Blob>;
    outputPdf(type: string): Promise<unknown>;
  }
  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
