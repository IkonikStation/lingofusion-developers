# Optional terminology lookup

The Playground's web-search option retains the selected LingoFusion model instead of replacing it with a search-only chatbot. The gateway uses the Responses API's optional hosted `web_search` tool with `tool_choice: auto`, `max_tool_calls: 1`, low search context, and no parallel tools.

The added translation policy directs the model to translate familiar content directly; search only for a genuinely unfamiliar term, ambiguous expression, proper name or technical phrase; treat source questions as text to translate, never questions to answer; and produce only the translated source. Pages and snippets remain untrusted reference data. The core model prompts remain intact. This is a model instruction, not a deterministic guarantee about language-model behavior.

Supported combinations are LingoFusion, Pro and Ultra at Standard speed. Other models and speeds are rejected before paid dispatch. Client-defined tools remain forbidden. Lookup sources are retained from provider annotations and shown separately from the translated text.

The published search fees remain $0.015, $0.04 and $0.15 respectively per actual search. No search fee is charged if the model performs no lookup. Verified input/output tokens, including retrieved context and reasoning, are priced at the selected model's existing rates. A conservative 128K-token search-context bound and one tool fee are included in the prepaid reservation; unused credit is released on verified settlement. Holds can therefore be larger than ordinary translation holds. Replays return stored receipts without dispatching another search. Excessive or unverifiable tool usage fails closed for reconciliation.

References: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Responses API tool limits](https://developers.openai.com/api/reference/resources/responses/methods/create), [tool pricing](https://developers.openai.com/api/docs/pricing).

The same change fixes Playground music start/poll authentication by attaching the signed-in session bearer token. Music continues using the existing Treblo v3 gateway adapter and server-only Treblo credentials.

Validation uses mocked provider responses only. Tests cover selected-model routing, optional/no-search behavior, source preservation, fee calculation, sources, SSE metadata, replay, tool limits, and authenticated Treblo start/poll. Actual model instruction-following and provider-account access have not been tested with paid calls.
