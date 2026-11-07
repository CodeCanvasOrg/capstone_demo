# HS Code Data Cleaning and Ingestion for Trade Classification

HumbleBeeAI consolidated fragmented HS code guidance and optimized 65.5 million product descriptions into a searchable data foundation for trade classification. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/465b701b-80e1-4633-ad70-304bee5d69a6/asset)

## Executive Summary

HumbleBeeAI’s Data Cleaning & Ingestion for HS Code Systems covers two related efforts: consolidating HS rules and code relationships scattered across PDFs, and cleaning a large catalog of product descriptions mapped to 10-digit HS codes. The work created structured data for customs officers, businesses planning international expansion, and developers building trade applications. The case study describes a working foundation for AI-powered classification; it does not provide a production deployment status for a specific end-user application. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a8add353-db22-4345-b417-b6941090a7df/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a1350216-64f3-4741-abe7-482f2afb8d13/asset)

## Context and Challenge

HS codes shape tariffs, regulations, and product tracking in cross-border trade, but the source data was difficult to use consistently. Definitions, detailed code information, rules, and exceptions were spread across disconnected PDFs, sometimes with overlapping or conflicting information. Users had to search multiple files and manually cross-reference related codes; inconsistent formatting also impeded automation. Initial storage in separate databases required multiple queries and produced slow or incomplete retrieval. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/ed66c42f-b635-4991-8958-8cd917f8b7bc/asset) [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a8add353-db22-4345-b417-b6941090a7df/asset)

A separate scale and quality problem affected a dataset of about 65.5 million product descriptions mapped to 10-digit HS codes. Repeated products appeared with small spelling, punctuation, or formatting differences, creating storage waste and search results dominated by near-duplicates. The size also made processing slow and resource-intensive, limiting the practicality of real-time applications. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a3142871-e6f2-4b4d-8e5c-fd8bee5b6b1e/asset)

## Solution and Capabilities

The work addressed both reference data and real-world product descriptions, combining data cleanup with structured storage and retrieval. The case study reports a dual-database approach using Pinecone for semantic search and MongoDB for structured access. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a1350216-64f3-4741-abe7-482f2afb8d13/asset)

### Consolidated HS code guidance

Scattered HS information was organized into two structured Excel datasets: one containing 4-digit code definitions, redirections, rules, and clarifications, and another representing hierarchical relationships across the HS taxonomy. Row-by-row ingestion and unified indexes support consistent storage. Pinecone supports semantic searches based on natural-language product descriptions, while MongoDB supports structured queries and hierarchical browsing. [PDF p. 2](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/430023b2-11e6-4771-8cdc-cf06aa95418b/asset)

### Deduplication with product-frequency information

For product descriptions, the cleaning process lowercased text and standardized formatting, then used text analysis to identify entries that were effectively alike despite wording variations. Clustering grouped duplicates rather than simply discarding them, retaining counts of how often products appear in the trade data. The resulting unique descriptions were ingested into Pinecone for semantic search and MongoDB for structured storage. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/c7a85860-5e73-4fdd-bc6e-9c9bd8622a29/asset)



![Illustration of structured trade data being stored and searched by users](assets/4f5f7dee-9225-454b-a8be-c19cadfd9e5a.png)

The supplied illustration depicts users working with organized data and search; it is illustrative rather than a technical system diagram.

## Results and Business Impact

The case study reports the following outcomes for the two projects: [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/2d93d18b-b578-48c3-bb02-c5d7e6e10193/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/51d537e4-7e98-4c47-a52f-fd30b9d518ba/asset)

- Product-description dataset: reduced from 65.5 million records to about 2 million unique records, a reported 97% reduction, while retaining frequency counts to preserve product-popularity information. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/51d537e4-7e98-4c47-a52f-fd30b9d518ba/asset)
- HS code lookup: users can retrieve complete information for a code through a single query rather than searching multiple sources; the case study says results that previously required manual searches through multiple PDFs return in seconds. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/2d93d18b-b578-48c3-bb02-c5d7e6e10193/asset)
- Search and storage: the case study reports more diverse, representative search results instead of pages of duplicates, improved query performance, and lower storage costs after deduplication. It does not provide measured timings, cost amounts, or a quantified search-accuracy score. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/51d537e4-7e98-4c47-a52f-fd30b9d518ba/asset)
- Application foundation: the integrated data is described as supporting AI and machine-learning applications that need clean, structured training data; specific downstream business outcomes are not quantified. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/18a52617-fb26-42bc-ba8d-edcf2e36022f/asset)

The source does not report a measured reduction in customs processing time, tariff-calculation errors, or compliance incidents, so those business impacts cannot be quantified here.

## Limitations and Next Steps

The case study describes the data consolidation, deduplication, and dual-storage approach as completed project work, but it does not specify a production rollout, operational service levels, or measured downstream business results. Its references to future AI-powered classification, automated compliance checking, and trade analytics describe potential future applications, not confirmed delivered features. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/55a4d4f8-515e-4bf4-8b24-1a04220ee40d/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/18a52617-fb26-42bc-ba8d-edcf2e36022f/asset)

The supplied source identifies an “Open original HumbleBeeAI page” link, but does not include its URL; an original-page address therefore cannot be reproduced from the provided material. [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/465b701b-80e1-4633-ad70-304bee5d69a6/asset)

## Conclusion

These projects transformed fragmented HS guidance and highly repetitive product descriptions into structured, searchable datasets. The reported 97% reduction in product-description records and the consolidation of code information into single-query access demonstrate the data-engineering value described in the case study, while measured downstream business impact and production deployment status remain unspecified. [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/51d537e4-7e98-4c47-a52f-fd30b9d518ba/asset) [PDF p. 3](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/2d93d18b-b578-48c3-bb02-c5d7e6e10193/asset) [PDF p. 1](http://localhost:3344/workspaces/ab6b13a5-514c-4849-96d2-cd4008c5c310/documents/7cb0ac09-4271-4028-8985-5430c8e78a03/evidence/a1350216-64f3-4741-abe7-482f2afb8d13/asset)

