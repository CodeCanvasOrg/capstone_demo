# AI-powered Customs Intelligence System

An AI-powered customs intelligence system brings official Harmonized System (HS) code definitions and historical trade descriptions together to help customs officers and international businesses classify goods. [PDF source: c1e453a9-987b-4df4-8e5a-67965d9ff372]

## Executive Summary

Customs officers, importers and exporters need to identify the right HS code for products, but legal definitions and historical declarations were fragmented across separate sources. HumbleBeeAI’s Customs Optimization Project combined these materials in a chatbot-based classification system. The supplied case study describes the system and reports evaluation results; its PDF text has been reviewed, while owner approval and portfolio review remain pending. See the [original HumbleBeeAI case study](https://humblebee.ai/case-studies/ai-customs-intelligence). [PDF source: 4f55f8ce-aa59-497e-b2e8-4346301c2750] [PDF source: 9a569c39-7a08-4d46-8111-37be08a219e8]

## Context and Challenge

Classification required officers to search and cross-reference millions of customs records, often taking several minutes for a product. The 65.5 million product descriptions in the MSSQL source database contained duplication and inconsistent formatting, making searches slow and results harder to trust. At the same time, official HS definitions were not integrated with practical examples from trade declarations. Officers and businesses therefore had to reconcile legal requirements with real-world precedent themselves; international businesses were also described as relying on consultants and brokers for classification support. [PDF source: 9f1b58e0-4be2-4683-8b58-ba5832fbbb1a]

## Solution and Capabilities

### A unified reference for definitions and trade precedent

The system combines the Custom Clarification Project’s official HS-code framework—including sections, chapters and explanatory notes—with the Custom Optimization Project’s historical customs descriptions. Its chatbot uses LangChain and GPT models to respond to natural-language product queries with relevant code suggestions and supporting context, connecting legal definitions with similar real-world products. [PDF source: c1e453a9-987b-4df4-8e5a-67965d9ff372] [PDF source: 083189dc-f285-462a-96ac-1249d862b168]

### Data preparation and ranked suggestions

The reported pipeline deduplicated and normalized records, generated semantic embeddings, and stored them for semantic search. For a product query, the interface presents ranked HS-code suggestions with justifications drawing on official requirements and practical precedent; predictions are formatted as valid 10-digit codes. [PDF source: 1c96f92d-9d0b-4318-953e-6da6b0610beb] [PDF source: 083189dc-f285-462a-96ac-1249d862b168]

## Results and Business Impact

The case study reports 76.5% Top-1 accuracy (the correct 10-digit code as the first suggestion), 94.1% Top-3 accuracy (the correct code among the first three suggestions), and mean reciprocal rank (MRR) of 0.8515. It also reports classification time changing from several minutes to seconds. These are source-reported figures, not independently validated business outcomes; the evaluation sample size, split and test conditions are not provided. The 65.5 million descriptions are the source corpus, not the number of evaluation queries. No quantified business impact has been supplied. [PDF source: 4f55f8ce-aa59-497e-b2e8-4346301c2750] [PDF source: ee4cd7e4-027b-4383-92d8-336375474237]

## Limitations and Next Steps

The reported accuracy figures lack evaluation-set size, split details and independent validation, so they should be read with those limitations. The case study describes the solution’s capabilities but does not establish current production availability or provide a deployment status. No additional roadmap or next steps have been provided; further work should not be assumed. [PDF source: 4f55f8ce-aa59-497e-b2e8-4346301c2750]

## Conclusion

The project addresses the gap between formal HS-code definitions and the historical product descriptions used in day-to-day customs classification. Its reported combined knowledge base and chatbot make both types of evidence available together, with promising reported ranking results whose validation conditions remain unspecified. [PDF source: c1e453a9-987b-4df4-8e5a-67965d9ff372] [PDF source: 4f55f8ce-aa59-497e-b2e8-4346301c2750]

## Sources and Review Notes

AI-powered Customs Intelligence System — original source. PDF evidence pages: 1–4.[ Open source](https://humblebee.ai/case-studies/ai-customs-intelligence) [PDF source: 4f55f8ce-aa59-497e-b2e8-4346301c2750] [PDF source: f3ceafa5-36b5-4001-b2ca-75f006e6eab5] [PDF source: 73740b31-2230-49e2-8d6c-d24734e7219f] [PDF source: ee4cd7e4-027b-4383-92d8-336375474237]

Source-reviewed outcome: Reported 76.5% Top-1 and 94.1% Top-3 HS-code accuracy, MRR 0.8515; source corpus contains 65.5 million descriptions.

Evidence gaps: Evaluation set size, split and independent validation not provided; corpus size is not the number of evaluation queries.

Measurement — HS-code Top-1 accuracy: 76.5%. PDF p. 1,2,4. Comparison / conditions: Correct 10-digit HS code as first suggestion. Qualification: Evaluation sample/split absent

Measurement — HS-code Top-3 accuracy: 94.1%. PDF p. 1,2,4. Comparison / conditions: Correct code in first three suggestions. Qualification: Evaluation sample/split absent

Measurement — Mean reciprocal rank: 0.8515. PDF p. 2,4. Comparison / conditions: HS-code ranking. Qualification: Evaluation sample/split absent

Measurement — Historical product-description corpus: 65.5 million. PDF p. 1,2,3,4. Comparison / conditions: MSSQL customs records. Qualification: Input corpus, not query evaluation set

Review draft. Company approval of claims and figures is pending. Original URLs are transcribed from the supplied PDFs; current remote availability has not been verified.
