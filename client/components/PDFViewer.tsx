"use client";

import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  sessionCode: string;
  slide: number;
  pdfPages: number;
  setPdfPages: (n: number) => void;
  className?: string;
  pageClassName?: string;
}

export default function PDFViewer({ sessionCode, slide, pdfPages, setPdfPages, className, pageClassName }: PDFViewerProps) {
  return (
    <Document
      file={`${process.env.NEXT_PUBLIC_API_URL}/uploads/${sessionCode}/raw.pdf`}
      onLoadSuccess={({ numPages }) => setPdfPages(numPages)}
      loading={<Loader2 className="w-12 h-12 animate-spin text-white/50 mx-auto mt-[40vh]" />}
      className={className || "absolute inset-0 flex items-center justify-center pointer-events-none"}
    >
      <Page
        pageNumber={slide && slide <= pdfPages ? slide : 1}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        height={typeof window !== 'undefined' ? window.innerHeight : 1080}
        className={pageClassName || ""}
      />
    </Document>
  );
}
