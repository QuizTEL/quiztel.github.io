// ============================================================
//  QuizTEL — Bulk Text Parser (file-parser.js)
//  Parses pasted text containing questions, options, answer,
//  and explanation into structured Firestore question objects.
// ============================================================

/**
 * Parses bulk pasted text into an array of question objects.
 * 
 * Supported Format Example:
 * ─────────────────────────
 * Q: What is Cloud Computing?
 * A) On-demand availability of computer system resources
 * B) A physical hard drive
 * C) Local server network
 * D) None of the above
 * Answer: A
 * Explanation: Cloud computing provides on-demand IT resources over the internet.
 * 
 * (Multiple questions can be pasted together in sequence)
 * ============================================================
 */
export function parseQuestionsFromText(text) {
  if (!text || typeof text !== "string") return [];

  const questions = [];

  // Split text into individual question blocks using regex matching Q:, Q1:, 1., Question 1:
  const blocks = text
    .split(/(?=(?:Q\d*|Question\s*\d*|\d+)\s*[:.)]\s)/i)
    .map(b => b.trim())
    .filter(b => b.length > 10);

  for (const block of blocks) {
    try {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      // Extract question text (removes Q:, Q1:, 1., Question 1:)
      const firstLine = lines[0];
      const qMatch = firstLine.match(/^(?:Q\d*|Question\s*\d*|\d+)\s*[:.)]?\s*(.+)/i);
      const questionText = qMatch ? qMatch[1].trim() : firstLine.trim();

      const options = [];
      let correctOptionIndex = -1;
      let explLines = [];
      let collectingExpl = false;

      // Option matching: A), A., a), (A), 1), 1.
      const optionRegex = /^(?:([A-Da-d])|(\d))\s*[).:\-]\s*(.+)/;
      // Answer matching: Answer: A, Ans: B, Correct Answer: 1
      const answerRegex = /^(?:Answer|Ans|Correct\s*Answer)\s*[:.\-]\s*([A-Da-d1-4])/i;
      // Explanation matching: Explanation: ..., Exp: ..., Reason: ...
      const explRegex   = /^(?:Explanation|Exp|Reason|Note)\s*[:.\-]\s*(.*)/i;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (collectingExpl) {
          if (answerRegex.test(line) || optionRegex.test(line)) {
            collectingExpl = false;
          } else {
            explLines.push(line);
            continue;
          }
        }

        const optMatch  = line.match(optionRegex);
        const ansMatch  = line.match(answerRegex);
        const explMatch = line.match(explRegex);

        if (ansMatch) {
          const val = ansMatch[1].toUpperCase();
          if ("ABCD".includes(val)) {
            correctOptionIndex = "ABCD".indexOf(val);
          } else if ("1234".includes(val)) {
            correctOptionIndex = parseInt(val) - 1;
          }
        } else if (explMatch) {
          const firstExpl = explMatch[1].trim();
          if (firstExpl) explLines.push(firstExpl);
          collectingExpl = true;
        } else if (optMatch) {
          const optText = optMatch[3].trim();
          options.push(optText);
        }
      }

      const explanation = explLines.join(" ").trim();

      // Validate question: requires text, at least 2 options, and a valid correct answer
      if (questionText && options.length >= 2 && correctOptionIndex >= 0 && correctOptionIndex < options.length) {
        // Ensure array has 4 options
        while (options.length < 4) {
          options.push("None of the above");
        }

        questions.push({
          text:               questionText,
          options:            options.slice(0, 4),
          correctOptionIndex: correctOptionIndex,
          explanation:        explanation || "No explanation provided."
        });
      }
    } catch (e) {
      console.warn("Skipped malformed question block:", e);
    }
  }

  return questions;
}
