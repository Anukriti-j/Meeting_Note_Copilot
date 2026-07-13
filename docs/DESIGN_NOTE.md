# Design note 

## Architecture pattern chosen, and why

I used two patterns deliberately rather than one. Ingestion (`src/pipeline.py`) is a
**sequential pipeline** — audio goes through STT, then structured summarization, then
storage, in a fixed order with no decision-making. That's the right fit because there's
nothing to plan: every meeting needs exactly the same three steps. Filing action items
(`src/agent.py`), on the other hand, is a **ReAct-style tool-calling agent**, because
which tools to call (and with what arguments) genuinely depends on the content of each
meeting's action items — some have due dates and should get a calendar event, some
don't. A fixed pipeline would have to hard-code that branching; an agent with tools lets
the model decide it per action item instead.

_[Your take: did you agree with this split once you'd run it a few times? Did the agent
ever call a tool you didn't expect, or refuse to call one it should have?]_

## A failure I hit while building, and how I debugged it

After seeding the store with my 4 sample meetings plus 2 real recordings I made myself,
my evaluation score dropped: a question that used to retrieve the right answer
("Who owns updating the support macros before the billing cutover?") started coming
back as "I can't find this in the provided context," even though the answer was
clearly sitting in the store. My first instinct was to suspect the LLM was refusing
too aggressively, but the system prompt hadn't changed.

I debugged it by bypassing the LLM entirely and calling `vector_store.query()` directly
with `top_k=10` to print every retrieved chunk with its raw cosine similarity. That
showed the actual answer chunk ("Action item: Priya will update support macros...",
similarity 0.483) ranked **10th**, well outside the `RAG_TOP_K=4` window my code was
using — it had been pushed out by other topically-similar chunks ("billing cutover",
"rollback plan") from the newer meetings I'd just added. The bug wasn't in the LLM or
the grounding logic at all; it was that a fixed `top_k=4` that worked fine on a 4-meeting
corpus stopped being wide enough once the corpus grew and multiple meetings started
competing for the same topic. Bumping `RAG_TOP_K` to 10 fixed it, confirmed by rerunning
`eval/run_eval.py` (6/8 -> 7/8).

## A tradeoff I made

`RAG_TOP_K` is a real precision/recall tradeoff, not just a knob. A low `top_k` (I
started at 4) keeps the context sent to the LLM small and cheap, and works fine while
the corpus is small — but as I added more meetings on similar topics, the correct chunk
started losing the ranking competition to plausible-but-wrong neighbors, causing false
"I can't find this" refusals (see above). Raising it to 10 fixed retrieval at the cost of
~2.5x more context tokens per `ask` call (roughly 280 -> 700 prompt tokens in my logs)
and a higher chance of the LLM being handed a couple of irrelevant chunks it has to
correctly ignore. I chose recall over minimizing token cost here, since a wrong "can't
find" refusal is worse for a meeting-notes tool than a slightly noisier context window
that the grounding system prompt is expected to filter through anyway.
