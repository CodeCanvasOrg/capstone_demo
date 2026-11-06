# Bojhona AI-Powered Customs Intelligence and HS Code Classification

Bojhona brings official HS-code definitions and real-world customs product data together in an AI-powered classification system for customs teams and trade businesses. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/b94f3b26-9ba0-4e5e-bf4f-787e7d5aeaa2/asset)

## Executive Summary

Bojhona is an in-development customs intelligence project designed for customs officers, managers, importers and exporters. Its purpose is to bridge the gap between the legal structure of Harmonized System (HS) codes and the product descriptions found in customs declarations, so users can explore classification recommendations with both kinds of information in one place. The project combines official HS-code definitions with a large-scale historical product-description dataset and a chatbot interface. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/72c6bda1-055c-4787-b912-5b390a549d4d/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/03b2b5f5-689d-402c-b8e4-e5004cf97b18/asset)

The project record lists its status as “in dev” and scope as “Mid.” The source describes the system and its capabilities, but does not establish that it is generally available in production. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/03b2b5f5-689d-402c-b8e4-e5004cf97b18/asset)

## Context and Challenge

Classification work was described as largely manual: customs officers searched through millions of records, while businesses often relied on consultants and brokers for help interpreting codes. That workflow could take time and risk misclassification, with potential compliance and financial consequences. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/3bfd32fd-cb58-41c9-a1a7-1803a6ec4d1b/asset)

The underlying records were also difficult to use consistently. The MSSQL customs database contained duplicate and inconsistent product descriptions, and the project’s two source streams remained separate: one organized legal HS-code definitions, while the other captured practical product descriptions from customs declarations. The source describes the historical dataset as “65.5+1.8 million product descriptions”; the supplied material does not explain that notation further. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/afa03214-65cc-4fde-ad82-634e5000d2bc/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/3bfd32fd-cb58-41c9-a1a7-1803a6ec4d1b/asset)



![Illustrative image of customs paperwork being reviewed at a desk](assets/f2188926-89af-43c4-8b90-b06a3e6b5e62.png)

## Solution and Capabilities

The documented solution brings data preparation, semantic search and a chatbot together to connect formal HS-code definitions with real-world product examples. The project source describes the following capabilities: [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/386cb6b6-585f-4eca-a97b-86df776585c8/asset)

### Data cleaning and preparation

- Connects to an MSSQL database containing “65.5+1.8 million product descriptions” and applies large-scale deduplication and normalization to address duplicate and inconsistent records.
- Processes the cleaned records in batches, preparing them for AI-driven retrieval.

### Semantic retrieval and chatbot

- Creates semantic embeddings with OpenAI text-embedding-3-small and stores them in Pinecone for semantic search; selected metadata is mirrored in MongoDB for filtering, analytics and chatbot-session context.
- Provides a chatbot described as built with FastAPI and LangChain, using GPT models to return HS-code suggestions with supporting context from legal definitions and real-world product examples.

### Combined classification view

- Brings together Phase A’s theoretical HS-code structure and Phase B’s practical customs product data for comparison.
- The source describes surfacing and justifying the top 10 suitable HS codes for a query, supporting side-by-side review and classification decisions.

These are capabilities documented in the project description. Given the recorded “in dev” status, the source does not confirm which are currently available to end users. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/386cb6b6-585f-4eca-a97b-86df776585c8/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/03b2b5f5-689d-402c-b8e4-e5004cf97b18/asset)

## Results and Business Impact

The source reports qualitative operational and decision-support benefits, but supplies no measured timings, accuracy figures, cost savings or evaluation results. It reports: [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/3d5e00c3-d1e0-48b9-a6fa-bd19c6a33a9a/asset)

- Search and classification time reduced from minutes to seconds, as reported in the project source; no underlying measurement method or sample is provided.
- Deduplication and normalization are described as improving data consistency, while citation-backed answers are intended to support confidence in recommendations.
- Combining the two phases is reported to support comparison of classification results and identification of the top 10 relevant HS codes.
- A self-service chatbot is described as a way for importers and exporters to reduce reliance on consultants and make trade-related decisions more quickly; quantified cost or business-impact results are not provided.

These are source-reported outcomes, not independently measured results in the supplied material. No measured business impact or evaluation data has been provided. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/3d5e00c3-d1e0-48b9-a6fa-bd19c6a33a9a/asset)

## Limitations and Next Steps

The project is listed as in development. The source discusses evaluation and continuous improvement, including ablation studies of embedding models and chunking strategies, but does not state their results or establish which work remains planned versus completed. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/03b2b5f5-689d-402c-b8e4-e5004cf97b18/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/386cb6b6-585f-4eca-a97b-86df776585c8/asset)

The supplied source material does not include a destination URL for the referenced “Open original HumbleBeeAI page” link. A clickable original-source link therefore cannot be reproduced without inventing a URL. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/b94f3b26-9ba0-4e5e-bf4f-787e7d5aeaa2/asset)

## Conclusion

Bojhona’s documented approach addresses a clear customs-data challenge: connecting formal HS-code rules with inconsistent real-world product records. Its in-development system brings those sources into a shared retrieval and chatbot workflow, with source-reported gains in speed and support for classification review. Quantified accuracy, cost and business-impact results have not been supplied. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/72c6bda1-055c-4787-b912-5b390a549d4d/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/3d5e00c3-d1e0-48b9-a6fa-bd19c6a33a9a/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/a4131402-bce4-4cb7-96f3-bfc2e5900631/evidence/03b2b5f5-689d-402c-b8e4-e5004cf97b18/asset)

