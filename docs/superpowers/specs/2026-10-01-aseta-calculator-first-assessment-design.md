# Aseta Calculator-First Landing & Assessment Design

**Status:** Draft — awaiting user review
**Date:** 2026-10-01
**Scope:** Aseta Self-Serve landing page and client-side assessment

## Context

The existing landing page presents a long product-marketing sequence before its operational impact simulator. It also has a five-step assessment that derives three internal labels (`Aseta Scale`, `Aseta Maintenance`, `Aseta Foundation`) from incomplete, opaque priority rules. Several answers do not affect the result, while the copy implies that the assessment can conclude Aseta is not currently needed.

The user wants the calculator to appear first, the page to be shorter, and recommendations to match the distinction between Aseta Essentials and Aseta Enterprise. The user approved a three-result assessment, internal decision documentation, and preserving the customer lead/PDF flow.

## Goals

1. Put the operational impact calculator immediately after the site header.
2. Shorten the landing page by consolidating repeated marketing sections.
3. Replace the five-step quiz with a clear multi-select needs checklist.
4. Return one of three recommendations with an explainable reason:
   - Aseta Enterprise
   - Aseta Essentials
   - Belum membutuhkan Aseta
5. Produce an internal-only decision map that enumerates every checklist combination without exposing it in the customer landing or customer PDF.
6. Keep assessment answers client-side and ephemeral; do not send them to Google Sheets.
7. Preserve the existing lead capture, required fields, WhatsApp handoff, and customer-facing simulator PDF behavior.

## Non-goals

- No new server/backend or Apps Script endpoint for assessment.
- No persistence or analytics for assessment answers.
- No changes to lead consent, lead fields, lead storage, WhatsApp contact, or customer PDF contents/gating.
- No public download/link to the internal decision map.
- No invented feature tier rules for details that remain unconfirmed (e.g. hardware, hosting/on-premise, security, custom pricing).
- No pricing or asset-count threshold for deciding Essentials vs Enterprise.

## Product classification

The supplied product comparison describes Essentials as inventory and physical-audit management, and Enterprise as all Essentials capabilities plus lifecycle-financial and maintenance functions. Ordinary location/PIC tracking and basic transfer/relocation are Essentials. Formal cross-branch approvals or ERP integration are Enterprise triggers.

### Checklist needs

Use a single multi-select checklist, grouped by tier. Each feature is an independently selectable checkbox.

**Essentials — inventory and physical audit**

- Registrasi/tagging aset (RFID / QR Code / barcode)
- Stock opname atau audit fisik melalui scanner
- Pelacakan lokasi aset dan penanggung jawab/PIC
- Mutasi atau relokasi aset biasa

**Enterprise — lifecycle, financial, and maintenance**

- Depresiasi otomatis aset
- Preventive/corrective maintenance and ticket/work-order handling
- Formal asset borrowing and disposal/write-off records
- Approval mutasi lintas cabang / multi-branch control
- Integration with ERP/accounting via API

Provide one mutually exclusive choice: **“Belum membutuhkan Aseta — proses saat ini masih terkendali dan belum ada rencana perubahan.”** Choosing it clears/disables the feature checkboxes; choosing any feature clears this option.

### Deterministic decision rules

Evaluate selected Enterprise needs first:

1. One or more Enterprise needs selected → **Aseta Enterprise**. The reason names all selected Enterprise triggers and notes Enterprise includes Essentials capabilities.
2. No Enterprise needs but one or more Essentials needs selected → **Aseta Essentials**. The reason names all selected Essentials needs.
3. No feature need selected and the explicit “Belum membutuhkan” choice selected → **Belum membutuhkan Aseta**.
4. No feature need and no explicit no-need choice → show validation and no recommendation; do not infer an answer.

Asset quantity is intentionally excluded as a tier discriminator. Answers are held in page memory only and are not submitted to Apps Script.

## Landing structure

Keep the shared header/navigation. Reorder and consolidate the main page to:

1. **Impact calculator** directly after the header (financial tab first; existing time-efficiency tab remains available).
2. **Assessment and recommendation checklist**.
3. **Compact product proof** combining key feature summary, demo entry, and fit/not-fit guidance; eliminate repeated standalone sales copy.
4. **FAQ and one compact next-step/contact CTA**.
5. Existing footer.

Remove or merge the oversized standalone hero, proof strip, four-step workflow narrative, six-card feature grid, and separate fit section as needed to avoid repeating the same claims. Keep one concise Aseta value statement in the compact product proof area if the calculator-first layout needs product context. Maintain responsive behavior, a single H1, accessible form controls, and working anchor links.

## Internal decision map PDF

Generate a separate internal PDF outside the published repository/site, for example under the user's local project/output directory, containing:

- The accepted Essentials and Enterprise feature mappings.
- Decision precedence and no-need rule.
- Every possible checkbox combination and its resulting recommendation/reason. With 9 feature checkboxes there are 512 feature subsets, including one invalid empty subset; together with the mutually exclusive no-need choice, this gives 513 possible states, of which 512 are valid. Enumerate all states and make the recommendation totals auditable.
- An explicit note that the rules reflect user-provided product information and are not a replacement for further production-team validation.

The internal PDF must not be linked from, committed into, or deployed with the public landing page.

## Customer lead/PDF flow preservation

The existing simulator lead dialog remains gated by all required fields (name, business email, company, job title, WhatsApp, consent). The Apps Script endpoint and existing generated financial simulator PDF remain unchanged. The internal decision map is not added to this customer PDF and assessment answers are not included in the lead payload.

## Error handling and accessibility

- Require at least one feature choice or the explicit no-need choice before displaying results.
- Keep no-need choice exclusive in both UI state and validation.
- Provide a visible/announced validation message and keyboard-accessible checkboxes.
- Recommendation explanation must be generated from selected needs rather than generic copy.
- All existing simulator and lead submission errors retain their current behavior.
- Ensure reduced-motion preferences and responsive layouts remain supported.

## Verification criteria

1. Automated decision tests cover all 513 valid states and verify Enterprise precedence, Essentials fallback, explicit no-need behavior, and invalid empty selection.
2. Browser flow verifies exclusive no-need choice, feature selection clears no-need, no recommendation appears for empty selection, and recommendation text reflects selected triggers.
3. Existing simulator, required-field, PDF, Apps Script, and WhatsApp flows continue to pass.
4. Browser inspection confirms the calculator is the first main content section after the header, page sections are shorter/consolidated, and anchor navigation still works.
5. The internal decision PDF exists outside the deployable site/repository and contains the full combination map; public HTML and assets do not link to it.
6. No assessment responses are added to lead request fields or spreadsheet schema.

## Open points deliberately excluded from this draft

- Production-team validation of tier feature names/availability. The initial mapping uses the user's supplied screenshots; additional unsupported claims in the other screenshot (hardware, hosting model, security tier) are omitted.
- Any decision to persist assessment responses or send them to customer PDFs; current approved design explicitly excludes both.
