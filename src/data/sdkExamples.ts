export const sdkExamples = {
  curl: {
    label: "cURL",
    filename: "request.sh",
    syntax: "bash",
    code: `curl https://api.lingofusion.ai/v1/translate \\
  --request POST \\
  --header "Authorization: Bearer YOUR_API_KEY" \\
  --header "Content-Type: application/json" \\
  --header "Idempotency-Key: UNIQUE_VALUE" \\
  --data '{
    "model": "LingoFusion Pro",
    "pricing_mode": "default",
    "input": "Hello, how are you?",
    "from_language": "English",
    "to_language": "French",
    "stream": false
  }'`,
  },
  javascript: {
    label: "JavaScript",
    filename: "translate.mjs",
    syntax: "javascript",
    code: `const response = await fetch(
  "https://api.lingofusion.ai/v1/translate",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.LINGOFUSION_API_KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      model: "LingoFusion Pro",
      pricing_mode: "default",
      input: "Hello, how are you?",
      from_language: "English",
      to_language: "French",
      stream: false,
    }),
  },
);

if (!response.ok) {
  throw new Error(\`LingoFusion request failed: \${response.status}\`);
}

console.log(await response.json());`,
  },
  typescript: {
    label: "TypeScript",
    filename: "translate.ts",
    syntax: "typescript",
    code: `type TranslationResponse = {
  id: string;
  model: string;
  output_text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
};

const response = await fetch(
  "https://api.lingofusion.ai/v1/translate",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.LINGOFUSION_API_KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      model: "LingoFusion Pro",
      pricing_mode: "default",
      input: "Hello, how are you?",
      from_language: "English",
      to_language: "French",
      stream: false,
    }),
  },
);

if (!response.ok) {
  throw new Error(\`LingoFusion request failed: \${response.status}\`);
}

const result = (await response.json()) as TranslationResponse;
console.log(result.output_text, result.usage.cost_usd);`,
  },
  python: {
    label: "Python",
    filename: "translate.py",
    syntax: "python",
    code: `import os
import uuid
import requests

response = requests.post(
    "https://api.lingofusion.ai/v1/translate",
    headers={
        "Authorization": f"Bearer {os.environ['LINGOFUSION_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "model": "LingoFusion Pro",
        "pricing_mode": "default",
        "input": "Hello, how are you?",
        "from_language": "English",
        "to_language": "French",
        "stream": False,
    },
    timeout=30,
)
response.raise_for_status()

result = response.json()
print(result["output_text"])
print(f"Cost: \${result['usage']['cost_usd']}")`,
  },
  go: {
    label: "Go",
    filename: "main.go",
    syntax: "go",
    code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	payload, _ := json.Marshal(map[string]any{
		"model":         "LingoFusion Pro",
		"pricing_mode":  "default",
		"input":         "Hello, how are you?",
		"from_language": "English",
		"to_language":   "French",
		"stream":        false,
	})

	req, _ := http.NewRequest(
		http.MethodPost,
		"https://api.lingofusion.ai/v1/translate",
		bytes.NewReader(payload),
	)
	req.Header.Set("Authorization", "Bearer "+os.Getenv("LINGOFUSION_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer response.Body.Close()

	var result map[string]any
	json.NewDecoder(response.Body).Decode(&result)
	fmt.Println(result["output_text"])
}`,
  },
  java: {
    label: "Java",
    filename: "Translate.java",
    syntax: "java",
    code: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Translate {
  public static void main(String[] args) throws Exception {
    String body = """
      {
        "model": "LingoFusion Pro",
        "pricing_mode": "default",
        "input": "Hello, how are you?",
        "from_language": "English",
        "to_language": "French",
        "stream": false
      }
      """;

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.lingofusion.ai/v1/translate"))
        .header("Authorization", "Bearer " + System.getenv("LINGOFUSION_API_KEY"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();

    HttpResponse<String> response = HttpClient.newHttpClient().send(
        request,
        HttpResponse.BodyHandlers.ofString()
    );
    System.out.println(response.body());
  }
}`,
  },
  csharp: {
    label: "C#",
    filename: "Program.cs",
    syntax: "csharp",
    code: `using System.Net.Http.Headers;
using System.Net.Http.Json;

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
    "Bearer",
    Environment.GetEnvironmentVariable("LINGOFUSION_API_KEY")
);

var response = await client.PostAsJsonAsync(
    "https://api.lingofusion.ai/v1/translate",
    new {
        model = "LingoFusion Pro",
        pricing_mode = "default",
        input = "Hello, how are you?",
        from_language = "English",
        to_language = "French",
        stream = false,
    }
);
response.EnsureSuccessStatusCode();

Console.WriteLine(await response.Content.ReadAsStringAsync());`,
  },
  php: {
    label: "PHP",
    filename: "translate.php",
    syntax: "php",
    code: `<?php

$payload = json_encode([
    "model" => "LingoFusion Pro",
    "pricing_mode" => "default",
    "input" => "Hello, how are you?",
    "from_language" => "English",
    "to_language" => "French",
    "stream" => false,
]);

$request = curl_init("https://api.lingofusion.ai/v1/translate");
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("LINGOFUSION_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => $payload,
]);

$response = curl_exec($request);
curl_close($request);

echo $response;`,
  },
  ruby: {
    label: "Ruby",
    filename: "translate.rb",
    syntax: "ruby",
    code: `require "json"
require "net/http"

uri = URI("https://api.lingofusion.ai/v1/translate")
request = Net::HTTP::Post.new(uri)
request["Authorization"] = "Bearer #{ENV.fetch("LINGOFUSION_API_KEY")}"
request["Content-Type"] = "application/json"
request.body = {
  model: "LingoFusion Pro",
  pricing_mode: "default",
  input: "Hello, how are you?",
  from_language: "English",
  to_language: "French",
  stream: false
}.to_json

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

puts JSON.pretty_generate(JSON.parse(response.body))`,
  },
  swift: {
    label: "Swift",
    filename: "Translate.swift",
    syntax: "swift",
    code: `import Foundation

let url = URL(string: "https://api.lingofusion.ai/v1/translate")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue(
    "Bearer \\(ProcessInfo.processInfo.environment["LINGOFUSION_API_KEY"]!)",
    forHTTPHeaderField: "Authorization"
)
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONSerialization.data(withJSONObject: [
    "model": "LingoFusion Pro",
    "pricing_mode": "default",
    "input": "Hello, how are you?",
    "from_language": "English",
    "to_language": "French",
    "stream": false,
])

let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
    throw URLError(.badServerResponse)
}

print(String(decoding: data, as: UTF8.self))`,
  },
} as const;

export type SdkLanguage = keyof typeof sdkExamples;
