// ============================================================
//  QuizTEL — File Parser (file-parser.js)
//  Client-side PDF and DOCX parsing using:
//    • PDF.js  (loaded via CDN in admin.html)
//    • Mammoth.js (loaded via CDN in admin.html)
//
//  Expected document format:
//  ─────────────────────────
//  Q: What is the capital of France?
//  A) Berlin
//  B) Paris
//  C) Rome
//  D) Madrid
//  Answer: B
//  Explanation: Paris is the capital city of France.
//
//  (Blank line between questions is optional)
// ============================================================

// ── Text Extractor — PDF ─────────────────────────────────────
export async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        // pdfjsLib must be loaded globally via CDN script in admin.html
        const pdf  = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");
          fullText += pageText + "\n";
        }
        resolve(fullText);
      } catch (err) {
        reject(new Error("PDF parsing failed: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Text Extractor — DOCX ────────────────────────────────────
export async function extractTextFromDOCX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // mammoth must be loaded globally via CDN script in admin.html
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
        resolve(result.value);
      } catch (err) {
        reject(new Error("DOCX parsing failed: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Question Parser ───────────────────────────────────────────
/**
 * Parses raw text into an array of question objects.
 * Supports the structured format described at the top of this file.
 * @param {string} text - Raw extracted text from PDF or DOCX
 * @returns {Array<{text, options, correctOptionIndex, explanation}>}
 */
export function parseQuestionsFromText(text) {
  const questions = [];

  // Normalize line endings and split into blocks by double newline or "Q:"
  // Strategy: find each Q: block
  const blocks = text.split(/(?=Q\s*[:.)]\s)/i).filter(b => b.trim().length > 20);

  for (const block of blocks) {
    try {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      // Extract question text
      const qMatch = lines[0].match(/^Q\s*[:.)]?\s*(.+)/i);
      if (!qMatch) continue;
      const questionText = qMatch[1].trim();

      // Extract options
      const options = [];
      const optionRegex = /^([A-Da-d])\s*[).:\-]\s*(.+)/;
      const answerRegex = /^Answer\s*[:.]\s*([A-Da-d])/i;
      const explRegex   = /^Explanation\s*[:.]\s*(.*)/i;

      let correctOptionIndex = -1;
      let explanation = "";
      let collectingExpl = false;
      let explLines = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (collectingExpl) {
          // Keep collecting explanation lines until next block marker
          if (answerRegex.test(line) || optionRegex.test(line)) {
            collectingExpl = false;
          } else {
            explLines.push(line);
            continue;
          }
        }

        const optMatch = line.match(optionRegex);
        const ansMatch = line.match(answerRegex);
        const explMatch = line.match(explRegex);

        if (optMatch) {
          options.push(optMatch[2].trim());
        } else if (ansMatch) {
          const letter = ansMatch[1].toUpperCase();
          correctOptionIndex = "ABCD".indexOf(letter);
        } else if (explMatch) {
          const firstLine = explMatch[1].trim();
          if (firstLine) explLines.push(firstLine);
          collectingExpl = true;
        }
      }

      explanation = explLines.join(" ").trim();

      // Validate: must have question, 4 options, valid answer
      if (
        questionText &&
        options.length >= 2 &&
        correctOptionIndex >= 0 &&
        correctOptionIndex < options.length
      ) {
        // Pad to 4 options if fewer
        while (options.length < 4) options.push("");

        questions.push({
          text:               questionText,
          options:            options.slice(0, 4),
          correctOptionIndex: correctOptionIndex,
          explanation:        explanation || "No explanation provided."
        });
      }
    } catch {
      // Skip malformed blocks silently
      continue;
    }
  }

  return questions;
}

// ── Main entry point ──────────────────────────────────────────
/**
 * Parse a File object (PDF or DOCX) and return question objects.
 * @param {File} file
 * @returns {Promise<Array>}
 */
export async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  let text = "";

  if (ext === "pdf") {
    text = await extractTextFromPDF(file);
  } else if (ext === "docx" || ext === "doc") {
    text = await extractTextFromDOCX(file);
  } else {
    throw new Error("Unsupported file type. Please upload a .pdf or .docx file.");
  }

  const questions = parseQuestionsFromText(text);

  if (questions.length === 0) {
    throw new Error(
      "No questions found. Make sure your document follows the required format:\n" +
      "Q: <question>\nA) <option>\nB) <option>\nC) <option>\nD) <option>\nAnswer: A\nExplanation: <text>"
    );
  }

  return questions;
}
