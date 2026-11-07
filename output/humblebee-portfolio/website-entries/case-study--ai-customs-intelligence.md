# AI-Powered Customs Intelligence System: Faster HS Code Classification

An AI-powered customs intelligence system brings official HS code guidance and real-world product records together to help users classify traded goods faster. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9a569c39-7a08-4d46-8111-37be08a219e8/asset)

## Executive Summary

HumbleBeeAI’s Customs Optimization Project combined the legal structure of HS codes with 65.5 million product descriptions from customs declarations in an AI-powered classification system. It is intended to support customs officers and international businesses, including importers and exporters, who need to connect formal code definitions with examples from trade data. The case study reports that classification requests that previously took minutes could be handled in seconds. It also reports chatbot evaluation results of 76.5% Top-1 accuracy and 94.1% Top-3 accuracy (MRR 0.8515). The source describes the system as delivered, but does not specify its production deployment or availability. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/c1e453a9-987b-4df4-8e5a-67965d9ff372/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)

The supplied PDF references an “Open original HumbleBeeAI page” link, but does not include its URL, so a working original-page link cannot be reproduced here. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9a569c39-7a08-4d46-8111-37be08a219e8/asset)



![Illustration of a customs officer reviewing a shipment with an importer](assets/90f1a31d-0cd2-46d6-9187-e23c954e7bd9.png)

## Context and Challenge

HS codes shape tariffs, regulations and trade statistics, but the source describes a gap between official legal definitions and product descriptions encountered in customs declarations. Officers had to search and cross-reference information manually, a process that could take several minutes per classification and was prone to delay and human error. Importers and exporters had limited direct access to reliable classification tools and often depended on consultants or brokers. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/c1e453a9-987b-4df4-8e5a-67965d9ff372/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9f1b58e0-4be2-4683-8b58-ba5832fbbb1a/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/f3ceafa5-36b5-4001-b2ca-75f006e6eab5/asset)

The underlying customs dataset contained 65.5 million product descriptions, with duplication and inconsistent formatting that made search less reliable. At the same time, the legal HS framework and practical customs records were maintained as separate bodies of information, making it difficult to validate a candidate code against both official guidance and real-world precedent. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9f1b58e0-4be2-4683-8b58-ba5832fbbb1a/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/f3ceafa5-36b5-4001-b2ca-75f006e6eab5/asset)

## Solution and Capabilities

The project brought together the Custom Clarification Project’s official HS code structure and the Custom Optimization Project’s product data in a shared classification workflow. This was designed to let users consider the legal basis for a code alongside practical examples, rather than switching between disconnected sources. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/4f55f8ce-aa59-497e-b2e8-4346301c2750/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/083189dc-f285-462a-96ac-1249d862b168/asset)

### Cleaned and searchable trade data

- The system connected to the MSSQL database containing 65.5 million product descriptions and applied deduplication and normalization to address redundant entries and inconsistent formatting. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/1c96f92d-9d0b-4318-953e-6da6b0610beb/asset)
- The cleaned records were converted into semantic embeddings using OpenAI’s text-embedding-3-small model and stored in Pinecone for semantic search, with key metadata mirrored in MongoDB for filtering and analytical queries. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/1c96f92d-9d0b-4318-953e-6da6b0610beb/asset)

### Chat-based classification guidance

A natural-language chatbot, built with FastAPI and LangChain and leveraging GPT models, accepts product descriptions and returns HS code suggestions with supporting context. Recommendations include explanations referencing official definitions and similar products, so users can inspect why a code was proposed. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/083189dc-f285-462a-96ac-1249d862b168/asset)

### Side-by-side legal and practical comparison

The unified workflow compares results drawn from the theoretical HS framework and practical product data. The case study describes surfacing the top 10 suitable or relevant HS codes with supporting justifications, giving users context for comparing classification options. This is decision support; the source does not describe the chatbot as a substitute for an officer’s or business user’s compliance judgment. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/083189dc-f285-462a-96ac-1249d862b168/asset) [PDF p. 4](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/c578423d-8f92-44f9-bad6-5092cfa03458/asset)

## Results and Business Impact

The case study reports the following technical evaluation and workflow observations: [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9a569c39-7a08-4d46-8111-37be08a219e8/asset)

- 76.5% Top-1 accuracy and 94.1% Top-3 accuracy, with MRR 0.8515. The source says the correct code is the first suggestion about 76.5% of the time and appears within the top three about 94.1% of the time. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)
- All predictions were formatted as valid 10-digit HS codes. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)
- Classification time was reported as reduced from several minutes of manual searching and cross-referencing to seconds through the AI interface. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9a569c39-7a08-4d46-8111-37be08a219e8/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)
- The case study says expanding recommendations from Top-3 to Top-5 did not increase coverage and lowered precision; it recommends presenting Top-2 or Top-3. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)

These figures describe technical evaluation and reported workflow timing. The source does not provide a measured business-level impact such as cost savings, throughput change, reduced error rates in live operations, or effects on trade outcomes. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)

## Limitations and Next Steps

The available case study does not specify deployment environment, production availability, user adoption, ongoing operating arrangements, or the evaluation dataset and test methodology. Accordingly, the reported accuracy and timing should not be read as independently verified production outcomes. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)

The case study recommends presenting Top-2 or Top-3 suggestions rather than Top-5, because it reports no additional coverage from expanding to Top-5 and lower precision. No further roadmap or planned functionality is provided in the supplied material. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset)

## Conclusion

The project addresses a practical customs classification challenge by combining official HS code guidance with a large collection of real-world product descriptions in a natural-language search and comparison workflow. Its reported evaluation indicates useful classification performance and faster query handling, while production status and broader business outcomes remain unspecified in the source material. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/c1e453a9-987b-4df4-8e5a-67965d9ff372/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/ee4cd7e4-027b-4383-92d8-336375474237/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/1dd51dde-087e-4fd8-8645-d1a3ca95fc5d/evidence/9a569c39-7a08-4d46-8111-37be08a219e8/asset)

