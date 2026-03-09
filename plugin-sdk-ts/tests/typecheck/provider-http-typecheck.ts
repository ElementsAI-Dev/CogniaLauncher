import { cognia } from "../../src";
import type { HttpResponse, ProviderInfo } from "../../src";

const providers: ProviderInfo[] = cognia.env.providerList();
const provider = providers[0];

if (provider) {
  const capabilities: string[] = provider.capabilities;
  const platforms: string[] = provider.platforms;
  const priority: number = provider.priority;
  const enabled: boolean = provider.enabled;
  void capabilities;
  void platforms;
  void priority;
  void enabled;
}

const response: HttpResponse = cognia.http.request({
  url: "https://example.com/api",
  method: "POST",
  headers: { "x-demo": "1" },
  body: "{\"ok\":true}",
  timeoutMs: 2000,
});

const getResponse: HttpResponse = cognia.http.get("https://example.com/ping");
const postResponse: HttpResponse = cognia.http.post(
  "https://example.com/ping",
  "{\"ok\":true}",
);

void response;
void getResponse;
void postResponse;
