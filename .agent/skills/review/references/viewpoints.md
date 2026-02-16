# Review Viewpoints for Devil's Advocate

This document defines the specific viewpoints and criteria for a critical review. The goal is to identify risks before they become incidents.

## 1. Fatal Defect (致命的な欠陥)
*Issues that threaten the system's existence, security, or legal compliance.*

* **Security & Privacy (Zero Trust)**:
    * Are there specific vulnerabilities (SQLi, XSS, CSRF, IDOR, SSRF)?
    * Is PII (Personally Identifiable Information) properly encrypted and masked in logs?
    * Are secrets (API keys, passwords) hardcoded?
* **Scalability & Performance (The "100x" Test)**:
    * Will the system crash if traffic spikes by 100x? (N+1 queries, unindexed DB searches, synchronous blocking calls).
    * Are there potential resource leaks (memory, database connections, file handles)?
* **Data Integrity (ACID & Idempotency)**:
    * Is data consistency guaranteed across distributed transactions? (Is "Eventual Consistency" handled?)
    * Are write operations **idempotent**? (What happens if the same API request is sent twice due to network lag?)
    * Is there a risk of race conditions in concurrent processing?

## 2. Operability & Maintainability (運用性と保守性) - *NEW*
*Issues that make the system a nightmare to maintain or debug.*

* **Observability & Debuggability**:
    * When an error occurs, does the log provide enough context (Trace ID, User ID, input parameters) to reproduce it?
    * Are error messages meaningful to the operator (not just "System Error")?
* **Coupling & Complexity**:
    * Is there "Spaghetti Code" or circular dependencies between modules?
    * Are there "God Classes" or huge functions doing too many things?
    * Is the configuration separated from the code?
* **Hard Dependencies**:
    * Does the logic rely on unstable external factors (system time, specific hardware paths, third-party availability) without fallback?

## 3. Logical Contradiction & Gaps (論理的矛盾と欠落)
*Inconsistencies within the logic or against reality.*

* **Business Logic Validity**:
    * Does the implementation actually match the business requirement, or did the developer "interpret" it conveniently?
    * Are state transitions valid? (e.g., Can a "Cancelled" order be "Shipped"?)
* **Temporal Logic**:
    * Are timeouts and retries defined? (Infinite waiting leads to system hang).
    * Is the sequence of events logically possible even under network delays?

## 4. Testability & Edge Cases (テスト容易性と境界値)
*If you can't test it, it's broken.*

* **Testability**:
    * Is the logic isolated enough to be unit-tested without mocking the entire universe?
    * Are there non-deterministic behaviors (randomness, current time) that make testing flaky?
* **Edge Cases (The "Unhappy" Path)**:
    * Null/Empty/Undefined inputs.
    * Maximum/Minimum values (Integer overflow, empty lists).
    * Malicious inputs (Emojis in text fields, huge payloads).
* **Error Handling**:
    * Does the system fail strictly (secure) or fail open (insecure)?
    * Are exceptions swallowed (try-catch with empty block)?

## 5. Migration & Compatibility (移行と互換性) - *NEW*
*Issues that cause explosions upon deployment.*

* **Backward Compatibility**:
    * Does this change break existing clients or mobile apps that haven't updated yet?
    * Is the database schema change non-locking and reversible?
* **Deployment Risks**:
    * Is there a rollout/rollback plan?
    * Does the deployment require downtime? (Is that acceptable?)