"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle } from "lucide-react";
import { SwitchSettingItem } from "./setting-item";

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
  const allowHttp = localConfig["security.allow_http"] === "true";

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
        <SwitchSettingItem
          id="allow-http"
          label={t("settings.allowHttp")}
          description={t("settings.allowHttpDesc")}
          checked={allowHttp}
          onCheckedChange={(checked) =>
            onValueChange("security.allow_http", checked.toString())
          }
        />
        {allowHttp && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("settings.allowHttpWarning")}
            </AlertDescription>
          </Alert>
        )}
        <Separator />
        <SwitchSettingItem
          id="verify-certs"
          label={t("settings.verifyCerts")}
          description={t("settings.verifyCertsDesc")}
          checked={localConfig["security.verify_certificates"] !== "false"}
          onCheckedChange={(checked) =>
            onValueChange("security.verify_certificates", checked.toString())
          }
        />
        <Separator />
        <SwitchSettingItem
          id="allow-self-signed"
          label={t("settings.allowSelfSigned")}
          description={t("settings.allowSelfSignedDesc")}
          checked={localConfig["security.allow_self_signed"] === "true"}
          onCheckedChange={(checked) =>
            onValueChange("security.allow_self_signed", checked.toString())
          }
        />
      </CardContent>
    </Card>
  );
}
