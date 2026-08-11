export type SalesRequest = {
  email: string;
  organization: string;
  seats: number;
  message: string;
  planId?: string;
  billingInterval?: "monthly" | "yearly";
};

export async function submitSalesRequest(request: SalesRequest) {
  const apiBaseUrl = String(import.meta.env.VITE_LINGOFUSION_API_URL || "").replace(/\/$/, "");
  const response = await fetch(`${apiBaseUrl}/api/sales-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "sales_request_failed");
  }
}