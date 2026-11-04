// Ultrafast is a Responses API tier. Normalize its public events into the
// chat contract used by our existing ledger and clients; retain provider IDs.
function chatResult(response) {
  if (!['completed', 'incomplete'].includes(response?.status) || response.error || !response.usage) {
    throw new Error('Provider response did not complete with usage');
  }
  const usage = response.usage;
  const content = (response.output || []).filter(x => x.type === 'message')
    .flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('');
  return { id: response.id, model: response.model, service_tier: response.service_tier,
    choices: [{ index: 0, message: { role: 'assistant', content },
      finish_reason: response.status === 'incomplete' ? 'length' : 'stop' }],
    usage: { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens, prompt_tokens_details: usage.input_tokens_details,
      completion_tokens_details: usage.output_tokens_details } };
}

export async function fetchTextProvider(prepared, options, providerFetch = fetch,
  endpoint = 'https://api.openai.com/v1/chat/completions') {
  const payload = prepared.payload;
  if (prepared.mode !== 'ultrafast') {
    return providerFetch(endpoint, { ...options, body: JSON.stringify(payload) });
  }
  if (endpoint !== 'https://api.openai.com/v1/chat/completions') throw new Error('Unverified Ultrafast endpoint');
  const input = payload.messages.map(message => ({ ...message,
    content: Array.isArray(message.content) ? message.content.map(part => ({ ...part, type: 'input_text' })) : message.content }));
  const response = await providerFetch('https://api.openai.com/v1/responses', { ...options,
    body: JSON.stringify({ model: payload.model, input, stream: payload.stream,
      service_tier: 'ultrafast', max_output_tokens: payload.max_completion_tokens,
      reasoning: { effort: payload.reasoning_effort },
      prompt_cache_options: payload.prompt_cache_options }) });
  if (!response.ok) return response;
  if (!payload.stream) return Response.json(chatResult(await response.json()));
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  let buffer = '', id, model, completed = false;
  return new Response(response.body.pipeThrough(new TransformStream({
    transform(value, controller) {
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 2000000) throw new Error('Provider frame too large');
      let boundary;
      const emit = data => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === 'response.created') { id = event.response.id; model = event.response.model; }
          if (event.type === 'response.output_text.delta') emit({ id, model, choices: [{ index: 0, delta: { content: event.delta } }] });
          if (event.type === 'response.completed' || event.type === 'response.incomplete') {
            const result = chatResult(event.response);
            emit({ ...result, choices: [{ index: 0, delta: {}, finish_reason: result.choices[0].finish_reason }] });
            controller.enqueue(encoder.encode('data: [DONE]\n\n')); completed = true;
          }
          if (event.type === 'error' || event.type === 'response.failed') throw new Error('Provider response failed');
        }
      }
    },
    flush() { if (!completed || buffer.trim()) throw new Error('Provider stream ended without final usage'); },
  })), { headers: { 'Content-Type': 'text/event-stream' } });
}
