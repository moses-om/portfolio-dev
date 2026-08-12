# MIRA Canonical Knowledge Taxonomy & FAQ Topology Audit Report

> [!IMPORTANT]
> **READ-ONLY AUDIT**: Zero production code files, server logic, portfolio definitions, or FAQ cache datasets were modified during this phase.

---

## 1. Executive Summary

A structural topology audit was conducted across the **13 verified canonical FAQ entries** in `backend/data/faq-cache.json` containing **98 total question variants**.

### Key Findings
- **High Alignment**: **93 of 98 variants (94.9%)** are correctly placed under their respective canonical FAQ entries.
- **Phase 12 Misplacement Root Cause**: All **5 Phase 12 human-approved candidate promotions** landed in `identity-overview` (the default index 0 entry) because the CLI tool (`review-candidates.js`) used a fallback matching logic (`faqEntries.find(f => f.category === candidate.category) || faqEntries[0]`) when no exact string match existed.
- **Zero Factual Impairment**: Grounding accuracy remains at **100%**, and Gemini avoidance remains at **95.92%**. However, migrating the 5 misplaced variants to their true semantic FAQ targets will improve topology clarity.

---

## 2. Topology Audit Matrix (13 Canonical FAQ Entries)

| FAQ ID | Category | Original Variants | Promoted Variants | Total Variants | Semantic Placement Status | Misplaced Variants Count & Recommended Destination |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `identity-overview` | `identity` | 10 | 5 | 15 | ⚠️ **Contains 5 Misplaced Variants** | 5 misplaced variants from Phase 12 fallback logic: <br>• *"Tell me about Moses's degree..."* → `educational-background`<br>• *"how did Moses acquire data analysis skills"* → `data-engineering-sql`<br>• *"open ashesi ranking dashboard"* → `ashesi-ranking-project`<br>• *"how did moses build MIRA Intelligence?"* → `dpoe-research-architecture`<br>• *"where can i find published research paper on AI"* → `research-publications` |
| `power-bi-experience` | `bi` | 11 | 0 | 11 | ✅ `CORRECTLY_PLACED` | None |
| `educational-background` | `education` | 10 | 0 | 10 | ✅ `CORRECTLY_PLACED` | None |
| `data-engineering-sql` | `data-engineering` | 8 | 0 | 8 | ✅ `CORRECTLY_PLACED` | None |
| `ashesi-work-experience` | `experience` | 8 | 0 | 8 | ✅ `CORRECTLY_PLACED` | None |
| `research-publications` | `research` | 9 | 0 | 9 | ✅ `CORRECTLY_PLACED` | None |
| `forage-virtual-simulations` | `simulations` | 7 | 0 | 7 | ✅ `CORRECTLY_PLACED` | None |
| `applied-ai-toolstack` | `skills` | 7 | 0 | 7 | ✅ `CORRECTLY_PLACED` | None |
| `ashesi-ranking-project` | `projects` | 5 | 0 | 5 | ✅ `CORRECTLY_PLACED` | None |
| `dpoe-research-architecture` | `research` | 6 | 0 | 6 | ✅ `CORRECTLY_PLACED` | None |
| `ea-hub-project` | `projects` | 4 | 0 | 4 | ✅ `CORRECTLY_PLACED` | None |
| `chatgpt-chat-porter` | `projects` | 4 | 0 | 4 | ✅ `CORRECTLY_PLACED` | None |
| `contact-information` | `contact` | 4 | 0 | 4 | ✅ `CORRECTLY_PLACED` | None |

---

## 3. Phase 12 Promotion Placement Analysis

The 5 variants promoted during Phase 12 were evaluated individually:

1. **`"Tell me about Moses's degree & educational background."`**
   - *Current Placement*: `identity-overview`
   - *Classification*: 🔴 `CLEARLY_MISPLACED`
   - *Target Destination*: `educational-background`

2. **`"how did Moses acquire his data analysis skills"`**
   - *Current Placement*: `identity-overview`
   - *Classification*: 🔴 `CLEARLY_MISPLACED`
   - *Target Destination*: `data-engineering-sql` or `applied-ai-toolstack`

3. **`"open the ashesi university ranking dashboard"`**
   - *Current Placement*: `identity-overview`
   - *Classification*: 🔴 `CLEARLY_MISPLACED`
   - *Target Destination*: `ashesi-ranking-project`

4. **`"how did moses build MIRA Intelligence?"`**
   - *Current Placement*: `identity-overview`
   - *Classification*: 🔴 `CLEARLY_MISPLACED`
   - *Target Destination*: `dpoe-research-architecture`

5. **`"where can i find his publisihed research paper on AI"`**
   - *Current Placement*: `identity-overview`
   - *Classification*: 🔴 `CLEARLY_MISPLACED`
   - *Target Destination*: `research-publications`

---

## 4. Taxonomy & Structural Observations

- **Overly Broad Entries**: `identity-overview` currently serves as the fallback target for uncategorized promoted candidates.
- **Underused Entries**: `chatgpt-chat-porter` (4 variants) and `ea-hub-project` (4 variants) have high factual fidelity but relatively few question variants.
- **Recommended CLI Improvement**: Enhance `review-candidates.js` to route candidate promotions based on keyword and semantic intent rather than defaulting to `faqEntries[0]`.

---

## 5. Migration Recommendations (For Future Phase)

1. **Refactor Promotion Destination Logic**: Update `backend/scripts/review-candidates.js` to map candidate queries to target FAQ IDs dynamically using domain keywords (`ashesi` → `ashesi-ranking-project`, `dpoe`/`mira` → `dpoe-research-architecture`, `degree` → `educational-background`, etc.).
2. **Topology Rebalancing**: Perform a 1-click migration script to re-assign the 5 misplaced variants from `identity-overview` into their respective canonical target FAQ entries in `faq-cache.json`.
