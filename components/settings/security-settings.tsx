"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

interface SecuritySettingsProps {
  localConfig: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

export function SecuritySettings({
  localConfig,
  onValueChange,
  t,
}: SecuritySettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" aria-hidden="true" />
          {t("settings.security")}
        </CardTitle>
        <CardDescription>{t("settings.securityDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="allow-http">{t("settings.allowHttp")}</Label>
            <p id="allow-http-desc" className="text-sm text-muted-foreground">
              {t("settings.allowHttpDesc")}
            </p>
          </div>
          <Switch
            id="allow-http"
            aria-describedby="allow-http-desc"
            checked={localConfig["security.allow_http"] === "true"}
            onCheckedChange={(checked) => {
              onValueChange("security.allow_http", checked.toString());
            }}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="verify-certs">{t("settings.verifyCerts")}</Label>
            <p id="verify-certs-desc" className="text-sm text-muted-foreground">
              {t("settings.verifyCertsDesc")}
            </p>
          </div>
          <Switch
            id="verify-certs"
            aria-describedby="verify-certs-desc"
            checked={localConfig["security.verify_certificates"] !== "false"}
            onCheckedChange={(checked) => {
              onValueChange("security.verify_certificates", checked.toString());
            }}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="allow-self-signed">
              {t("settings.allowSelfSigned")}
            </Label>
            <p
              id="allow-self-signed-desc"
              className="text-sm text-muted-foreground"
            >
              {t("settings.allowSelfSignedDesc")}
            </p>
          </div>
          <Switch
            id="allow-self-signed"
            aria-describedby="allow-self-signed-desc"
            checked={localConfig["security.allow_self_signed"] === "true"}
            onCheckedChange={(checked) => {
              onValueChange("security.allow_self_signed", checked.toString());
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
